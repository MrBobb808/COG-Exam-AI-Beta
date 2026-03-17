import React from 'react';

// ─── Existing Core Types ────────────────────────────────────────────────────

export interface WorkoutSet {
  weight: string;
  reps: string;
  estimated1RM?: number;
}

export type SessionType = 'strength' | 'bjj' | 'weight';

export interface WorkoutLog {
  id?: string;
  date: string;
  phase: string;
  day: string;
  type: SessionType;
  exercise?: string;
  sets?: WorkoutSet[];

  // BJJ specific
  rounds?: number;
  attendedClass?: boolean;

  // Reflection
  hardestPart?: string;
  whatWentWell?: string;
  techniqueNotes?: string;
  notes?: string;

  // Metrics
  sessionLoad?: number;
  caloriesBurned?: number;
  timestamp: string;
}

export interface RecoveryLog {
  id?: string;
  date: string;
  sleep: number; // 1-5
  energy: number; // 1-5
  soreness: number; // 1-5
  stress: number; // 1-5
  score: number;
  timestamp: string;
}

export interface DailyStats {
  id?: string;
  isDailyStats: boolean;
  date: string;
  time?: string;
  bodyWeight: number | null;
  bmi?: number;
  bodyFat?: number;
  water?: number;
  muscles?: number;
  bone?: number;
  caloriesBurned: number;
  caloriesConsumed?: number;
  baseCalories: number;
  trainingLoad: number;
  recoveryScore?: number;
  timestamp: string;
}

export interface UserProfile {
  hasCompletedOnboarding?: boolean;
  baseWeight?: number;
  height?: number; // inches
  gender?: 'male' | 'female';
  age?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
  onboardingDate?: string;
  bjjBelt?: 'White' | 'Blue' | 'Purple' | 'Brown' | 'Black';
  bjjStripes?: number;
  // Prompt 1: HealthKit preferences
  healthKitEnabled?: boolean;
  caloricDeficitTarget?: number; // daily kcal deficit goal (e.g., 500)
  carbCyclingEnabled?: boolean;
}

export interface Trophy {
  id: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  progress: number;
  unlocked: boolean;
  color: string;
  glow: string;
  bg: string;
  border: string;
}

export interface WeeklySummary {
  id?: string;
  weekEnding: string;
  poundsLost: number;
  bjjHours: number;
  liftingVolume: number; // lbs
  caloricAdherence: number; // percentage
  imageUrl?: string;
  prompt?: string;
  style: SummaryStyle;
  timestamp: string;
  // Prompt 2: Enhanced Nano Banana 2 fields
  mascotTier?: MascotTier;
  mascotAccessories?: string[];
  generationModel?: string;
}

// ─── Prompt 1: Apple HealthKit & Biometric Sync Engine ──────────────────────

/** Raw biometric sample pulled from Apple HealthKit */
export interface HealthKitBiometric {
  id?: string;
  date: string; // YYYY-MM-DD
  source: 'apple_watch' | 'iphone' | 'manual' | 'third_party';
  activeEnergyBurned?: number; // kcal — HKQuantityTypeIdentifierActiveEnergyBurned
  restingHeartRate?: number; // bpm — HKQuantityTypeIdentifierRestingHeartRate
  hrv?: number; // ms — HKQuantityTypeIdentifierHeartRateVariabilitySDNN
  sleepHours?: number; // total sleep duration
  sleepStages?: SleepStageBreakdown;
  vo2Max?: number; // mL/kg/min — bonus metric for strain estimation
  stepCount?: number;
  standHours?: number;
  syncedAt: string; // ISO timestamp of last successful sync
}

export interface SleepStageBreakdown {
  awake: number; // minutes
  rem: number;
  core: number; // light sleep
  deep: number;
}

/** Categorization of the day's training strain for macro adjustment */
export type StrainLevel = 'rest' | 'low' | 'moderate' | 'high' | 'extreme';

/** Dynamic daily macro targets adjusted by HealthKit data */
export interface DailyMacroTarget {
  id?: string;
  date: string; // YYYY-MM-DD
  strainLevel: StrainLevel;
  // Base values (from profile TDEE - deficit)
  baseCalories: number;
  baseProteinG: number;
  baseCarbsG: number;
  baseFatG: number;
  // Adjusted values (after HealthKit calibration)
  adjustedCalories: number;
  adjustedProteinG: number;
  adjustedCarbsG: number;
  adjustedFatG: number;
  // Delta applied
  calorieAdjustment: number;
  carbAdjustment: number;
  adjustmentReason: string; // human-readable reason for the shift
  // Source data that drove the adjustment
  activeEnergyUsed: number;
  sessionTypes: SessionType[]; // what workouts happened today
  timestamp: string;
}

/** Workout written back TO Apple Health */
export interface HealthKitWorkoutExport {
  id?: string;
  date: string;
  workoutLogId: string; // FK to workout_logs
  healthKitWorkoutType: 'functionalStrengthTraining' | 'martialArts';
  durationMinutes: number;
  totalEnergyBurned: number; // kcal
  averageHeartRate?: number;
  exportedAt: string; // ISO — when it was written to HealthKit
  exportStatus: 'pending' | 'success' | 'failed';
  errorMessage?: string;
}

/** Tracks sync state and handles missed-watch edge cases */
export interface HealthKitSyncState {
  lastSuccessfulSync: string; // ISO
  lastAttemptedSync: string;
  syncStatus: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
  missedSessionDates: string[]; // dates where watch wasn't worn
  manualOverrides: ManualBiometricOverride[];
}

/** Manual entry when user forgets Apple Watch during a session */
export interface ManualBiometricOverride {
  date: string;
  sessionType: SessionType;
  estimatedActiveEnergy: number; // kcal — estimated from MET * duration
  estimatedDuration: number; // minutes
  reason: 'watch_not_worn' | 'watch_dead' | 'no_gi_session' | 'other';
  enteredAt: string;
}

// ─── Prompt 2: Nano Banana 2 Weekly Summary Pipeline ────────────────────────

/** Mascot tier drives how "powered up" Biblit looks in the generated image */
export type MascotTier = 'base' | 'training' | 'warrior' | 'champion' | 'legendary';

/** Art style for image generation */
export type SummaryStyle = '3d' | 'comic' | 'photorealistic';

/** Configuration for the Nano Banana 2 image generation request */
export interface NanoBanana2Config {
  model: string; // e.g., 'gemini-3-flash-image'
  aspectRatio: '1:1' | '16:9' | '9:16';
  imageSize: '1K' | '2K' | '4K';
  style: SummaryStyle;
  negativePrompt?: string;
  seed?: number; // for reproducible generations
}

/** Scheduled pipeline run record */
export interface SummaryPipelineRun {
  id?: string;
  userEmail: string;
  scheduledFor: string; // ISO — every Sunday at 6 PM user-local
  status: 'scheduled' | 'aggregating' | 'generating' | 'overlaying' | 'complete' | 'failed';
  metrics?: {
    poundsLost: number;
    bjjHours: number;
    liftingVolume: number;
    caloricAdherence: number;
  };
  mascotTier?: MascotTier;
  generatedPrompt?: string;
  rawImageUrl?: string; // before text overlay
  finalImageUrl?: string; // after text overlay
  style: SummaryStyle;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  timestamp: string;
}

/** Mapping rules: metric thresholds → mascot state + accessories */
export interface MascotMapping {
  tier: MascotTier;
  minPoundsLost: number;
  minBjjHours: number;
  minLiftingVolume: number;
  minCaloricAdherence: number;
  description: string; // visual description injected into prompt
  accessories: string[]; // e.g., ["BJJ gi", "blue belt", "lifting belt"]
}

// ─── Prompt 3: Creator Export & Social Broadcasting Module ──────────────────

/** Aspect ratio presets for social platforms */
export type ExportAspectRatio = '1:1' | '16:9' | '9:16';

export interface ExportFormat {
  ratio: ExportAspectRatio;
  width: number;
  height: number;
  platform: SocialPlatform;
  label: string; // "Grid Post", "Reels / Stories", "Community Tab"
}

export type SocialPlatform =
  | 'instagram_grid'
  | 'instagram_reels'
  | 'instagram_stories'
  | 'tiktok'
  | 'youtube_community'
  | 'twitter'
  | 'native_share';

/** Connected social account for direct broadcasting */
export interface ConnectedSocialAccount {
  id?: string;
  platform: SocialPlatform;
  accountHandle: string; // e.g., "@asunis_desk"
  accessToken?: string; // encrypted — only stored server-side
  refreshToken?: string;
  connectedAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

/** A formatted export ready to share */
export interface FormattedExport {
  id?: string;
  weeklySummaryId: string; // FK to weekly_summaries
  format: ExportAspectRatio;
  platform: SocialPlatform;
  imageUrl: string; // formatted + cropped image
  caption?: string; // auto-generated caption
  hashtags?: string[];
  createdAt: string;
}

/** Archived weekly image for the macrocycle timelapse */
export interface TimelapseFrame {
  id?: string;
  weekNumber: number; // 1-12 within the macrocycle
  macrocycleId: string;
  weeklySummaryId: string;
  imageUrl: string; // 1:1 source image
  thumbnailUrl?: string;
  metrics: {
    poundsLost: number;
    bjjHours: number;
    liftingVolume: number;
    caloricAdherence: number;
  };
  weekEnding: string;
  createdAt: string;
}

/** A macrocycle (12-week block) that collects timelapse frames */
export interface Macrocycle {
  id?: string;
  userEmail: string;
  name?: string; // e.g., "Spring 2026 Cut"
  startDate: string;
  endDate?: string; // auto-calculated: startDate + 12 weeks
  status: 'active' | 'completed' | 'abandoned';
  frames: TimelapseFrame[];
  timelapseVideoUrl?: string; // generated MP4 URL
  timelapseStatus: 'pending' | 'generating' | 'complete' | 'failed';
  totalPoundsLost?: number;
  totalBjjHours?: number;
  totalLiftingVolume?: number;
  createdAt: string;
}

/** Configuration for the 15-second MP4 timelapse stitcher */
export interface TimelapseConfig {
  durationSeconds: number; // default 15
  fps: number; // default 2 (2 frames/sec for 12 weeks ≈ 6s, padded with transitions)
  transitionType: 'crossfade' | 'slide' | 'zoom' | 'none';
  includeMetricsOverlay: boolean;
  backgroundMusic?: 'epic' | 'chill' | 'none';
  outputResolution: { width: number; height: number };
}

// ─── Global Declarations ────────────────────────────────────────────────────

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
