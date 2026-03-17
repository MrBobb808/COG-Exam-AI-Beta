import { UserProfile, StrainLevel } from '../types';

export function calculateBMR(profile: UserProfile, currentWeightLbs: number): number {
  const weightKg = currentWeightLbs / 2.20462;
  const heightCm = (profile.height || 70) * 2.54; // Default 5'10"
  const age = profile.age || 30;
  const isMale = profile.gender !== 'female';

  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  bmr += isMale ? 5 : -161;

  return Math.max(0, bmr);
}

export function calculateTDEE(bmr: number, activityLevel: string = 'moderate'): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very: 1.725,
    extra: 1.9
  };
  return bmr * (multipliers[activityLevel] || 1.55);
}

export function calculateExerciseCalories(bmr: number, minutes: number, met: number = 6.0): number {
  return Math.round((bmr / 1440) * met * minutes);
}

// ─── Dynamic Macro Calibration Helpers ──────────────────────────────────────

/** MET values for BJJ and strength training */
export const EXERCISE_MET: Record<string, number> = {
  bjj_drilling: 5.0,
  bjj_sparring: 9.8,
  bjj_competition: 12.0,
  strength_heavy: 6.0,    // Compound lifts
  strength_moderate: 5.0,  // Accessory work
  strength_light: 3.5,     // Warm-up / mobility
  farmers_carry: 8.0,
  kettlebell_swings: 9.0,
};

/**
 * Estimate calories from MET value when no heart rate monitor / Apple Watch data available.
 * Formula: kcal = MET × body_weight_kg × duration_hours
 */
export function estimateCaloriesFromMET(
  met: number,
  bodyWeightLbs: number,
  durationMinutes: number
): number {
  const weightKg = bodyWeightLbs / 2.20462;
  const hours = durationMinutes / 60;
  return Math.round(met * weightKg * hours);
}

/**
 * Calculate base macro split in grams from total calories.
 * Returns { proteinG, carbsG, fatG }.
 */
export function calculateMacroSplit(
  totalCalories: number,
  proteinRatio: number,
  carbRatio: number,
  fatRatio: number
): { proteinG: number; carbsG: number; fatG: number } {
  return {
    proteinG: Math.round((totalCalories * proteinRatio) / 4),  // 4 kcal/g
    carbsG: Math.round((totalCalories * carbRatio) / 4),       // 4 kcal/g
    fatG: Math.round((totalCalories * fatRatio) / 9),           // 9 kcal/g
  };
}

/**
 * Protein floor: ensures minimum protein intake for muscle preservation during a cut.
 * Standard recommendation: 1g per pound of body weight for strength athletes.
 * For BJJ grapplers in a deficit: 1.1-1.2g/lb to account for higher metabolic demand.
 */
export function proteinFloor(bodyWeightLbs: number, isGrappler: boolean = true): number {
  const multiplier = isGrappler ? 1.1 : 1.0;
  return Math.round(bodyWeightLbs * multiplier);
}

/**
 * Calculate the calorie adjustment to add back on high-strain days.
 * Prevents excessive catabolism during combined lifting + BJJ sessions.
 *
 * Logic:
 *   - extreme strain: add back 60% of daily deficit
 *   - high strain: add back 30% of deficit
 *   - rest days: reduce carbs by ~60 kcal (15g)
 *   - other levels: no adjustment
 */
export function calculateStrainAdjustment(
  strain: StrainLevel,
  dailyDeficit: number
): { calorieAdjustment: number; carbAdjustmentG: number } {
  switch (strain) {
    case 'extreme':
      const extremeAdj = Math.round(dailyDeficit * 0.6);
      return { calorieAdjustment: extremeAdj, carbAdjustmentG: Math.round(extremeAdj / 4) };
    case 'high':
      const highAdj = Math.round(dailyDeficit * 0.3);
      return { calorieAdjustment: highAdj, carbAdjustmentG: Math.round(highAdj / 4) };
    case 'rest':
      return { calorieAdjustment: 0, carbAdjustmentG: -15 };
    default:
      return { calorieAdjustment: 0, carbAdjustmentG: 0 };
  }
}
