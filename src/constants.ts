/**
 * Constants for Mascot Tiers, Export Presets, and Strain Configuration
 *
 * Extends existing constants with Prompt 1-3 specific values.
 */

import { MascotMapping, ExportFormat, SummaryStyle } from './types';

// ─── Mascot Tier Thresholds ─────────────────────────────────────────────────

export const MASCOT_TIERS: MascotMapping[] = [
  {
    tier: 'legendary',
    minPoundsLost: 3,
    minBjjHours: 7,
    minLiftingVolume: 15000,
    minCaloricAdherence: 90,
    description: 'Biblit in a gleaming championship BJJ gi with golden trim, wearing a medal and a championship-grade leather lifting belt, standing triumphantly atop a podium in a cinematic arena with spotlights and confetti raining down',
    accessories: ['championship gi', 'gold trim', 'medal', 'lifting belt', 'golden wrist wraps'],
  },
  {
    tier: 'champion',
    minPoundsLost: 2,
    minBjjHours: 5,
    minLiftingVolume: 10000,
    minCaloricAdherence: 80,
    description: 'Biblit wearing a BJJ gi with a blue belt and a heavy leather lifting belt, looking victorious and powerful in a cinematic gym setting with dramatic side lighting',
    accessories: ['BJJ gi', 'blue belt', 'lifting belt'],
  },
  {
    tier: 'warrior',
    minPoundsLost: 1,
    minBjjHours: 3,
    minLiftingVolume: 5000,
    minCaloricAdherence: 70,
    description: 'Biblit in a white gi with lifting gloves, mid-training in an intense gym with chalk dust and iron plates scattered around',
    accessories: ['white gi', 'lifting gloves', 'chalk'],
  },
  {
    tier: 'training',
    minPoundsLost: 0,
    minBjjHours: 1,
    minLiftingVolume: 1000,
    minCaloricAdherence: 50,
    description: 'Biblit in casual workout gear, sweating but smiling, holding a kettlebell in a modern gym',
    accessories: ['workout gear', 'kettlebell'],
  },
  {
    tier: 'base',
    minPoundsLost: 0,
    minBjjHours: 0,
    minLiftingVolume: 0,
    minCaloricAdherence: 0,
    description: 'Biblit looking motivated and ready, standing at the gym entrance with determination in their eyes',
    accessories: ['gym bag'],
  },
];

// ─── Image Generation Style Prompts ─────────────────────────────────────────

export const STYLE_PROMPTS: Record<SummaryStyle, string> = {
  '3d': '3D animated style, Pixar-like, vibrant colors, soft global illumination, subsurface scattering, volumetric lighting, cinematic depth of field',
  'comic': 'Gritty comic book style, bold ink lines, dramatic shadows, high contrast, halftone dots, dynamic action framing, Frank Miller influence',
  'photorealistic': 'Photorealistic style, cinematic lighting, 8K resolution, highly detailed textures, shallow depth of field, anamorphic lens flare, shot on ARRI Alexa',
};

// ─── Export Format Presets ──────────────────────────────────────────────────

export const SOCIAL_EXPORT_FORMATS: ExportFormat[] = [
  { ratio: '1:1',  width: 1080, height: 1080, platform: 'instagram_grid',     label: 'Instagram Grid' },
  { ratio: '9:16', width: 1080, height: 1920, platform: 'instagram_reels',    label: 'Reels / Stories' },
  { ratio: '9:16', width: 1080, height: 1920, platform: 'tiktok',            label: 'TikTok' },
  { ratio: '16:9', width: 1920, height: 1080, platform: 'youtube_community', label: 'YouTube Community' },
  { ratio: '1:1',  width: 1080, height: 1080, platform: 'twitter',           label: 'Twitter / X' },
];

// ─── HealthKit Strain Configuration ─────────────────────────────────────────

export const STRAIN_CONFIG = {
  thresholds: {
    rest:     { maxActiveEnergy: 200 },
    low:      { maxActiveEnergy: 400 },
    moderate: { maxActiveEnergy: 600 },
    high:     { maxActiveEnergy: 900 },
    extreme:  { maxActiveEnergy: Infinity },
  },
  macroRatios: {
    rest:     { protein: 0.40, carbs: 0.25, fat: 0.35 },
    low:      { protein: 0.38, carbs: 0.30, fat: 0.32 },
    moderate: { protein: 0.35, carbs: 0.35, fat: 0.30 },
    high:     { protein: 0.33, carbs: 0.40, fat: 0.27 },
    extreme:  { protein: 0.30, carbs: 0.45, fat: 0.25 },
  },
  deficitRecovery: {
    extreme: 0.6,  // add back 60% of deficit
    high: 0.3,     // add back 30% of deficit
  },
  hrvStressThreshold: 30,  // ms — HRV below this applies 1.2x strain multiplier
} as const;

// ─── Timelapse Defaults ─────────────────────────────────────────────────────

export const TIMELAPSE_DEFAULTS = {
  durationSeconds: 15,
  fps: 2,
  transitionType: 'crossfade' as const,
  includeMetricsOverlay: true,
  backgroundMusic: 'epic' as const,
  outputResolution: { width: 1080, height: 1080 },
};

// ─── Auto-Generated Captions by Platform ────────────────────────────────────

export const PLATFORM_CAPTIONS: Record<string, string[]> = {
  instagram_grid: [
    'Another week in the forge. The grind never stops.',
    'Consistency over intensity. Week by week.',
    'Iron and mats. That\'s the formula.',
  ],
  instagram_reels: [
    'Weekly progress check. Building the body, sharpening the mind.',
    'The weekly forge — BJJ + lifting + discipline.',
  ],
  tiktok: [
    'Week in review — mats, iron, and discipline.',
    'POV: you tracked every rep and every roll this week.',
  ],
  youtube_community: [
    'This week\'s training breakdown. How are your weeks going?',
    'Weekly forge update — full breakdown below.',
  ],
  twitter: [
    'Weekly forge complete. Progress is progress.',
    'Another week locked in.',
  ],
};

// ─── Default Hashtags by Platform ───────────────────────────────────────────

export const PLATFORM_HASHTAGS: Record<string, string[]> = {
  instagram_grid: ['#MatForge', '#BJJ', '#Weightlifting', '#FitnessJourney', '#GymLife', '#BJJLifestyle', '#StrengthTraining'],
  instagram_reels: ['#MatForge', '#FitnessReels', '#GymReels', '#BJJReels', '#WorkoutMotivation'],
  tiktok: ['#MatForge', '#GymTok', '#BJJTok', '#FitnessTok', '#GainsCheck'],
  youtube_community: ['#MatForge', '#FitnessUpdate', '#TrainingLog'],
  twitter: ['#MatForge', '#FitTwitter', '#BJJCommunity'],
};
