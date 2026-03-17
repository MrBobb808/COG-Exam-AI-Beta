/**
 * HealthKit Sync Engine
 *
 * Two-way Apple HealthKit integration for BJJ + heavy lifting + weight loss.
 *
 * INGEST: Pulls Active Energy, RHR, HRV, Sleep from Apple Health → Firestore.
 * CALIBRATE: Dynamically adjusts daily carb/macro targets based on strain level.
 * EXPORT: Writes MatForge workouts back to Apple Health (strength → functionalStrengthTraining,
 *         BJJ → martialArts) so activity rings close accurately.
 * EDGE CASES: Detects missing watch data (no-gi sessions) and prompts manual override.
 *
 * NOTE: This service contains the data layer and business logic. The actual HealthKit
 * native bridge (Swift ↔ JS) would be implemented via a React Native module or
 * Capacitor plugin that calls these methods.
 */

import {
  collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  HealthKitBiometric,
  DailyMacroTarget,
  HealthKitWorkoutExport,
  HealthKitSyncState,
  ManualBiometricOverride,
  WorkoutLog,
  UserProfile,
  DailyStats,
  StrainLevel,
  SessionType,
} from '../types';
import { calculateBMR, calculateTDEE } from '../lib/calories';

// ─── MET Values for Calorie Estimation ──────────────────────────────────────

const MET_VALUES: Record<string, number> = {
  strength_heavy: 6.0,    // Heavy compound lifts (deadlift, squat, bench)
  strength_moderate: 5.0,  // Accessory work
  bjj_drilling: 5.0,       // Technique drilling
  bjj_sparring: 9.8,       // Live rolling — very high intensity
  bjj_competition: 12.0,   // Competition-level rolling
};

// ─── Strain Thresholds ──────────────────────────────────────────────────────

const STRAIN_THRESHOLDS = {
  rest:     { maxActiveEnergy: 200,  sessions: [] as SessionType[] },
  low:      { maxActiveEnergy: 400,  sessions: ['strength'] as SessionType[] },
  moderate: { maxActiveEnergy: 600,  sessions: ['strength'] as SessionType[] },
  high:     { maxActiveEnergy: 900,  sessions: ['strength', 'bjj'] as SessionType[] },
  extreme:  { maxActiveEnergy: Infinity, sessions: ['strength', 'bjj'] as SessionType[] },
};

// ─── Macro Ratio Presets by Strain Level ────────────────────────────────────

const MACRO_RATIOS: Record<StrainLevel, { protein: number; carbs: number; fat: number }> = {
  rest:     { protein: 0.40, carbs: 0.25, fat: 0.35 }, // Low carb on rest
  low:      { protein: 0.38, carbs: 0.30, fat: 0.32 },
  moderate: { protein: 0.35, carbs: 0.35, fat: 0.30 },
  high:     { protein: 0.33, carbs: 0.40, fat: 0.27 }, // Carbs up on heavy days
  extreme:  { protein: 0.30, carbs: 0.45, fat: 0.25 }, // Max carbs for lifting + sparring
};

export class HealthKitSyncService {
  private basePath: string;

  constructor(private appId: string, private userId: string) {
    this.basePath = `artifacts/${appId}/users/${userId}`;
  }

  // ─── DATA INGESTION ─────────────────────────────────────────────────────

  /**
   * Ingest a day's biometric data from Apple HealthKit.
   * Called by the native bridge after each background health sync.
   * Uses date as document ID for idempotent upserts.
   */
  async ingestBiometrics(data: HealthKitBiometric): Promise<void> {
    const docRef = doc(db, this.basePath, 'healthkit_biometrics', data.date);
    await setDoc(docRef, {
      ...data,
      syncedAt: new Date().toISOString(),
    }, { merge: true });
  }

  /**
   * Pull the latest biometric sample for a given date.
   */
  async getBiometrics(date: string): Promise<HealthKitBiometric | null> {
    const docRef = doc(db, this.basePath, 'healthkit_biometrics', date);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as HealthKitBiometric) : null;
  }

  /**
   * Get biometric history for the last N days.
   */
  async getBiometricHistory(days: number): Promise<HealthKitBiometric[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().split('T')[0];

    const q = query(
      collection(db, this.basePath, 'healthkit_biometrics'),
      where('date', '>=', startStr),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as HealthKitBiometric);
  }

  // ─── DYNAMIC CALORIE CALIBRATION ───────────────────────────────────────

  /**
   * Core algorithm: classify the day's strain level from workout logs + HealthKit data.
   *
   * Strain classification:
   *   rest     → No workouts, < 200 kcal active energy
   *   low      → Light workout OR < 400 kcal active
   *   moderate → Single strength session, 400-600 kcal
   *   high     → Heavy lifting + BJJ OR 600-900 kcal
   *   extreme  → Heavy lifting + BJJ sparring, > 900 kcal
   */
  classifyStrainLevel(
    activeEnergy: number,
    todaysSessions: SessionType[],
    hrv?: number,
    restingHR?: number
  ): StrainLevel {
    const hasBjj = todaysSessions.includes('bjj');
    const hasStrength = todaysSessions.includes('strength');
    const sessionCount = todaysSessions.filter(s => s !== 'weight').length;

    // HRV-based fatigue signal: if HRV is significantly below baseline,
    // the body is under more strain than the activity alone suggests
    const hrvStressMultiplier = (hrv && hrv < 30) ? 1.2 : 1.0;
    const adjustedEnergy = activeEnergy * hrvStressMultiplier;

    if (sessionCount === 0 && adjustedEnergy < 200) return 'rest';
    if (hasBjj && hasStrength && adjustedEnergy > 900) return 'extreme';
    if ((hasBjj && hasStrength) || adjustedEnergy > 600) return 'high';
    if (hasStrength || adjustedEnergy > 400) return 'moderate';
    if (adjustedEnergy > 200) return 'low';
    return 'rest';
  }

  /**
   * Calculate dynamically adjusted macros for a given day.
   *
   * PSEUDO-CODE:
   *   1. Compute base TDEE from profile (Mifflin-St Jeor + activity multiplier)
   *   2. Subtract caloric deficit target (e.g., 500 kcal) → base calories
   *   3. Classify today's strain from active energy + logged sessions
   *   4. On HIGH/EXTREME strain days: add back 30-60% of the deficit as carbs
   *      to prevent muscle catabolism during BJJ sparring + heavy lifts
   *   5. On REST days: reduce carbs further, increase fat slightly
   *   6. Protein stays high (min 1g/lb bodyweight) regardless of strain
   */
  async calibrateDailyMacros(
    date: string,
    profile: UserProfile,
    currentWeight: number,
    biometrics: HealthKitBiometric | null,
    todaysLogs: WorkoutLog[]
  ): Promise<DailyMacroTarget> {
    const bmr = calculateBMR(profile, currentWeight);
    const tdee = calculateTDEE(bmr, profile.activityLevel);
    const deficit = profile.caloricDeficitTarget || 500;
    const baseCalories = Math.round(tdee - deficit);

    // Classify strain
    const activeEnergy = biometrics?.activeEnergyBurned || 0;
    const sessionTypes = todaysLogs.map(l => l.type);
    const strain = this.classifyStrainLevel(
      activeEnergy,
      sessionTypes,
      biometrics?.hrv,
      biometrics?.restingHeartRate
    );

    // Base macro split
    const ratios = MACRO_RATIOS[strain];
    const baseProteinG = Math.round((baseCalories * ratios.protein) / 4); // 4 kcal/g
    const baseCarbsG = Math.round((baseCalories * ratios.carbs) / 4);
    const baseFatG = Math.round((baseCalories * ratios.fat) / 9); // 9 kcal/g

    // Dynamic adjustment based on active energy
    let calorieAdjustment = 0;
    let carbAdjustment = 0;
    let adjustmentReason = '';

    if (strain === 'extreme') {
      // Add back 60% of deficit as carbs to fuel double session
      calorieAdjustment = Math.round(deficit * 0.6);
      carbAdjustment = Math.round(calorieAdjustment / 4); // all added cals go to carbs
      adjustmentReason = `Extreme strain day (lifting + BJJ sparring, ${activeEnergy} kcal active). Adding ${calorieAdjustment} kcal as carbs to prevent catabolism.`;
    } else if (strain === 'high') {
      calorieAdjustment = Math.round(deficit * 0.3);
      carbAdjustment = Math.round(calorieAdjustment / 4);
      adjustmentReason = `High strain day (${activeEnergy} kcal active). Adding ${calorieAdjustment} kcal as carbs for recovery.`;
    } else if (strain === 'rest') {
      // On rest days, pull carbs down an extra 15g, add 7g fat
      carbAdjustment = -15;
      adjustmentReason = 'Rest day — reducing carbs, shifting to fat for satiety.';
    } else {
      adjustmentReason = `${strain.charAt(0).toUpperCase() + strain.slice(1)} strain — standard macro split.`;
    }

    // Ensure protein floor: minimum 1g per lb of bodyweight
    const proteinFloor = Math.round(currentWeight);
    const adjustedProteinG = Math.max(baseProteinG, proteinFloor);

    const adjustedCalories = baseCalories + calorieAdjustment;
    const adjustedCarbsG = baseCarbsG + carbAdjustment;
    const adjustedFatG = baseFatG; // fat stays stable

    const target: DailyMacroTarget = {
      date,
      strainLevel: strain,
      baseCalories,
      baseProteinG,
      baseCarbsG,
      baseFatG,
      adjustedCalories,
      adjustedProteinG,
      adjustedCarbsG,
      adjustedFatG,
      calorieAdjustment,
      carbAdjustment,
      adjustmentReason,
      activeEnergyUsed: activeEnergy,
      sessionTypes,
      timestamp: new Date().toISOString(),
    };

    // Persist to Firestore
    const docRef = doc(db, this.basePath, 'daily_macro_targets', date);
    await setDoc(docRef, target, { merge: true });

    return target;
  }

  // ─── DATA EXPORT TO APPLE HEALTH ──────────────────────────────────────

  /**
   * Map a MatForge workout to an Apple HealthKit workout type and write it back.
   *
   * Mapping:
   *   type === 'strength' → HKWorkoutActivityType.functionalStrengthTraining
   *   type === 'bjj'      → HKWorkoutActivityType.martialArts
   *
   * The native bridge (Swift) handles the actual HKWorkoutBuilder call.
   * This method records the export intent and status in Firestore.
   */
  async exportWorkoutToHealthKit(
    workoutLog: WorkoutLog,
    durationMinutes: number,
    averageHeartRate?: number
  ): Promise<HealthKitWorkoutExport> {
    const healthKitType = workoutLog.type === 'bjj'
      ? 'martialArts' as const
      : 'functionalStrengthTraining' as const;

    // Estimate calories if not recorded by watch
    const estimatedCalories = workoutLog.caloriesBurned || this.estimateCalories(
      workoutLog.type,
      durationMinutes,
      workoutLog.rounds
    );

    const exportRecord: HealthKitWorkoutExport = {
      date: workoutLog.date,
      workoutLogId: workoutLog.id || '',
      healthKitWorkoutType: healthKitType,
      durationMinutes,
      totalEnergyBurned: estimatedCalories,
      averageHeartRate,
      exportedAt: new Date().toISOString(),
      exportStatus: 'pending',
    };

    // Save to Firestore — the native layer will update status to 'success' or 'failed'
    const colRef = collection(db, this.basePath, 'healthkit_exports');
    const docRef = doc(colRef);
    await setDoc(docRef, exportRecord);

    return { ...exportRecord, id: docRef.id };
  }

  /**
   * Estimate calories from MET values when Apple Watch data is unavailable.
   * Used as fallback for the no-watch edge case.
   */
  private estimateCalories(
    type: SessionType,
    durationMinutes: number,
    rounds?: number
  ): number {
    let met: number;

    if (type === 'bjj') {
      // If high round count, assume sparring intensity
      met = (rounds && rounds >= 5) ? MET_VALUES.bjj_sparring : MET_VALUES.bjj_drilling;
    } else {
      met = MET_VALUES.strength_heavy;
    }

    // Rough kcal formula: MET * weight_kg * hours
    // Using 100kg (~220lbs) as default if weight unknown
    const weightKg = 100;
    const hours = durationMinutes / 60;
    return Math.round(met * weightKg * hours);
  }

  // ─── EDGE CASE: MISSING WATCH DATA ───────────────────────────────────

  /**
   * Detect if the user forgot their Apple Watch during a logged session.
   *
   * Heuristic: If a BJJ or strength session was logged but active energy
   * for that day is suspiciously low (< 100 kcal during a session window),
   * flag it as a missed-watch scenario.
   */
  async detectMissedWatch(
    date: string,
    todaysLogs: WorkoutLog[]
  ): Promise<{ missed: boolean; sessionTypes: SessionType[] }> {
    const biometrics = await this.getBiometrics(date);
    const activeEnergy = biometrics?.activeEnergyBurned || 0;

    const activeSessions = todaysLogs.filter(l => l.type !== 'weight');
    if (activeSessions.length === 0) {
      return { missed: false, sessionTypes: [] };
    }

    // If user logged a workout but active energy is implausibly low
    const expectedMinEnergy = activeSessions.length * 150; // at least 150kcal per session
    if (activeEnergy < expectedMinEnergy) {
      return {
        missed: true,
        sessionTypes: activeSessions.map(l => l.type),
      };
    }

    return { missed: false, sessionTypes: [] };
  }

  /**
   * Submit a manual biometric override when the watch wasn't worn.
   * This fills in estimated active energy so the macro calibration
   * algorithm still functions correctly.
   */
  async submitManualOverride(override: ManualBiometricOverride): Promise<void> {
    // Update the biometric record with estimated values
    const docRef = doc(db, this.basePath, 'healthkit_biometrics', override.date);
    const existing = await getDoc(docRef);

    const estimatedEnergy = override.estimatedActiveEnergy;

    if (existing.exists()) {
      const data = existing.data() as HealthKitBiometric;
      await setDoc(docRef, {
        ...data,
        activeEnergyBurned: (data.activeEnergyBurned || 0) + estimatedEnergy,
        source: 'manual' as const,
        syncedAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      await setDoc(docRef, {
        date: override.date,
        source: 'manual' as const,
        activeEnergyBurned: estimatedEnergy,
        syncedAt: new Date().toISOString(),
      });
    }
  }

  // ─── SYNC STATE MANAGEMENT ────────────────────────────────────────────

  async getSyncState(): Promise<HealthKitSyncState> {
    const docRef = doc(db, this.basePath, 'profile', 'healthkit_sync_state');
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data() as HealthKitSyncState;

    return {
      lastSuccessfulSync: '',
      lastAttemptedSync: '',
      syncStatus: 'idle',
      missedSessionDates: [],
      manualOverrides: [],
    };
  }

  async updateSyncState(updates: Partial<HealthKitSyncState>): Promise<void> {
    const docRef = doc(db, this.basePath, 'profile', 'healthkit_sync_state');
    await setDoc(docRef, updates, { merge: true });
  }
}
