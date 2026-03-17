/**
 * useHealthKit — React hook for HealthKit biometric sync and dynamic macro calibration.
 *
 * Provides:
 *   - Today's biometric data (Active Energy, HRV, RHR, Sleep)
 *   - 7-day biometric history for trend visualization
 *   - Today's dynamically calibrated macro targets
 *   - Sync state management (idle/syncing/error)
 *   - Missed-watch detection and manual override flow
 *   - Workout export to Apple Health
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { HealthKitSyncService } from '../services/HealthKitSyncService';
import {
  HealthKitBiometric,
  DailyMacroTarget,
  HealthKitSyncState,
  ManualBiometricOverride,
  WorkoutLog,
  UserProfile,
  DailyStats,
  StrainLevel,
} from '../types';

interface UseHealthKitOptions {
  appId: string;
  userId: string;
  profile: UserProfile | null;
  currentWeight: number;
  todaysLogs: WorkoutLog[];
  enabled?: boolean;
}

interface UseHealthKitReturn {
  // Biometric data
  todaysBiometrics: HealthKitBiometric | null;
  biometricHistory: HealthKitBiometric[];
  // Macro targets
  todaysMacros: DailyMacroTarget | null;
  strainLevel: StrainLevel;
  // Sync state
  syncState: HealthKitSyncState | null;
  isSyncing: boolean;
  syncError: string | null;
  // Actions
  triggerSync: () => Promise<void>;
  recalibrateMacros: () => Promise<void>;
  submitManualOverride: (override: ManualBiometricOverride) => Promise<void>;
  exportWorkout: (log: WorkoutLog, durationMinutes: number) => Promise<void>;
  // Edge cases
  missedWatchDetected: boolean;
  missedSessionTypes: string[];
  dismissMissedWatch: () => void;
  // Computed
  recoveryReadiness: 'good' | 'moderate' | 'low';
  activeEnergyToday: number;
}

export function useHealthKit({
  appId,
  userId,
  profile,
  currentWeight,
  todaysLogs,
  enabled = true,
}: UseHealthKitOptions): UseHealthKitReturn {
  const [todaysBiometrics, setTodaysBiometrics] = useState<HealthKitBiometric | null>(null);
  const [biometricHistory, setBiometricHistory] = useState<HealthKitBiometric[]>([]);
  const [todaysMacros, setTodaysMacros] = useState<DailyMacroTarget | null>(null);
  const [syncState, setSyncState] = useState<HealthKitSyncState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [missedWatchDetected, setMissedWatchDetected] = useState(false);
  const [missedSessionTypes, setMissedSessionTypes] = useState<string[]>([]);

  const service = useMemo(
    () => new HealthKitSyncService(appId, userId),
    [appId, userId]
  );

  const today = new Date().toISOString().split('T')[0];

  // ─── Load Initial Data ────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled || !userId) return;

    const loadData = async () => {
      try {
        const [bio, history, state] = await Promise.all([
          service.getBiometrics(today),
          service.getBiometricHistory(7),
          service.getSyncState(),
        ]);
        setTodaysBiometrics(bio);
        setBiometricHistory(history);
        setSyncState(state);
      } catch (err) {
        console.error('Failed to load HealthKit data:', err);
      }
    };

    loadData();
  }, [enabled, userId, today, service]);

  // ─── Auto-Calibrate Macros When Data Changes ─────────────────────────

  useEffect(() => {
    if (!enabled || !profile || !currentWeight) return;

    const calibrate = async () => {
      try {
        const macros = await service.calibrateDailyMacros(
          today, profile, currentWeight, todaysBiometrics, todaysLogs
        );
        setTodaysMacros(macros);
      } catch (err) {
        console.error('Macro calibration failed:', err);
      }
    };

    calibrate();
  }, [enabled, profile, currentWeight, todaysBiometrics, todaysLogs, today, service]);

  // ─── Missed Watch Detection ───────────────────────────────────────────

  useEffect(() => {
    if (!enabled || todaysLogs.length === 0) return;

    const detect = async () => {
      const result = await service.detectMissedWatch(today, todaysLogs);
      setMissedWatchDetected(result.missed);
      setMissedSessionTypes(result.sessionTypes);
    };

    detect();
  }, [enabled, todaysLogs, today, service]);

  // ─── Actions ──────────────────────────────────────────────────────────

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      await service.updateSyncState({
        lastAttemptedSync: new Date().toISOString(),
        syncStatus: 'syncing',
      });

      // In a real native bridge, this would call the Swift HealthKit API.
      // For now, we reload from Firestore (assuming the native layer pushed data).
      const bio = await service.getBiometrics(today);
      const history = await service.getBiometricHistory(7);

      setTodaysBiometrics(bio);
      setBiometricHistory(history);

      await service.updateSyncState({
        lastSuccessfulSync: new Date().toISOString(),
        syncStatus: 'idle',
      });

      // Re-calibrate macros with fresh data
      if (profile && currentWeight) {
        const macros = await service.calibrateDailyMacros(
          today, profile, currentWeight, bio, todaysLogs
        );
        setTodaysMacros(macros);
      }
    } catch (err: any) {
      setSyncError(err.message);
      await service.updateSyncState({
        syncStatus: 'error',
        errorMessage: err.message,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [service, today, profile, currentWeight, todaysLogs]);

  const recalibrateMacros = useCallback(async () => {
    if (!profile || !currentWeight) return;
    try {
      const macros = await service.calibrateDailyMacros(
        today, profile, currentWeight, todaysBiometrics, todaysLogs
      );
      setTodaysMacros(macros);
    } catch (err) {
      console.error('Recalibration failed:', err);
    }
  }, [service, today, profile, currentWeight, todaysBiometrics, todaysLogs]);

  const submitManualOverride = useCallback(async (override: ManualBiometricOverride) => {
    await service.submitManualOverride(override);
    setMissedWatchDetected(false);
    setMissedSessionTypes([]);

    // Refresh biometrics and recalibrate
    const bio = await service.getBiometrics(today);
    setTodaysBiometrics(bio);

    if (profile && currentWeight) {
      const macros = await service.calibrateDailyMacros(
        today, profile, currentWeight, bio, todaysLogs
      );
      setTodaysMacros(macros);
    }
  }, [service, today, profile, currentWeight, todaysLogs]);

  const exportWorkout = useCallback(async (log: WorkoutLog, durationMinutes: number) => {
    await service.exportWorkoutToHealthKit(log, durationMinutes);
  }, [service]);

  const dismissMissedWatch = useCallback(() => {
    setMissedWatchDetected(false);
    setMissedSessionTypes([]);
  }, []);

  // ─── Computed Values ──────────────────────────────────────────────────

  const strainLevel: StrainLevel = todaysMacros?.strainLevel || 'rest';
  const activeEnergyToday = todaysBiometrics?.activeEnergyBurned || 0;

  const recoveryReadiness = useMemo((): 'good' | 'moderate' | 'low' => {
    if (!todaysBiometrics) return 'moderate';

    const hrv = todaysBiometrics.hrv;
    const rhr = todaysBiometrics.restingHeartRate;
    const sleep = todaysBiometrics.sleepHours;

    // Good: high HRV (>50ms), low RHR (<65), good sleep (>7h)
    // Low: low HRV (<25ms) or high RHR (>80) or poor sleep (<5h)
    let score = 0;
    if (hrv) score += hrv > 50 ? 2 : hrv > 30 ? 1 : 0;
    if (rhr) score += rhr < 65 ? 2 : rhr < 75 ? 1 : 0;
    if (sleep) score += sleep > 7 ? 2 : sleep > 5.5 ? 1 : 0;

    if (score >= 5) return 'good';
    if (score >= 3) return 'moderate';
    return 'low';
  }, [todaysBiometrics]);

  return {
    todaysBiometrics,
    biometricHistory,
    todaysMacros,
    strainLevel,
    syncState,
    isSyncing,
    syncError,
    triggerSync,
    recalibrateMacros,
    submitManualOverride,
    exportWorkout,
    missedWatchDetected,
    missedSessionTypes,
    dismissMissedWatch,
    recoveryReadiness,
    activeEnergyToday,
  };
}
