/**
 * HealthKit Dashboard — Biometrics + Dynamic Macro Targets
 *
 * Displays:
 *   - Today's biometric snapshot (Active Energy, HRV, RHR, Sleep)
 *   - 7-day biometric trend sparklines
 *   - Today's strain level classification
 *   - Dynamic macro targets with base vs adjusted comparison
 *   - Recovery readiness indicator
 *   - Missed watch alert with manual override flow
 */

import React, { useState } from 'react';
import {
  Heart, Activity, Moon, Zap, RefreshCw, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Watch, ChevronRight, X,
  Flame, Beef, Wheat, Droplets
} from 'lucide-react';
import { useHealthKit } from '../hooks/useHealthKit';
import {
  WorkoutLog, UserProfile, ManualBiometricOverride, StrainLevel
} from '../types';
import { cn } from '../lib/utils';

interface HealthKitDashboardProps {
  appId: string;
  userId: string;
  profile: UserProfile | null;
  currentWeight: number;
  todaysLogs: WorkoutLog[];
}

const STRAIN_COLORS: Record<StrainLevel, { bg: string; text: string; glow: string }> = {
  rest:     { bg: 'bg-zinc-800', text: 'text-zinc-400', glow: '' },
  low:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
  moderate: { bg: 'bg-blue-500/10', text: 'text-blue-400', glow: 'shadow-blue-500/10' },
  high:     { bg: 'bg-amber-500/10', text: 'text-amber-400', glow: 'shadow-amber-500/10' },
  extreme:  { bg: 'bg-red-500/10', text: 'text-red-400', glow: 'shadow-red-500/10' },
};

const STRAIN_LABELS: Record<StrainLevel, string> = {
  rest: 'Rest Day',
  low: 'Low Strain',
  moderate: 'Moderate Strain',
  high: 'High Strain',
  extreme: 'Extreme Strain',
};

export default function HealthKitDashboard({
  appId, userId, profile, currentWeight, todaysLogs
}: HealthKitDashboardProps) {
  const {
    todaysBiometrics,
    biometricHistory,
    todaysMacros,
    strainLevel,
    isSyncing,
    syncError,
    triggerSync,
    submitManualOverride,
    exportWorkout,
    missedWatchDetected,
    missedSessionTypes,
    dismissMissedWatch,
    recoveryReadiness,
    activeEnergyToday,
  } = useHealthKit({ appId, userId, profile, currentWeight, todaysLogs });

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideDuration, setOverrideDuration] = useState(60);

  const handleManualOverride = async () => {
    const override: ManualBiometricOverride = {
      date: new Date().toISOString().split('T')[0],
      sessionType: (missedSessionTypes[0] as any) || 'bjj',
      estimatedActiveEnergy: Math.round(overrideDuration * 8.5), // ~8.5 kcal/min for BJJ
      estimatedDuration: overrideDuration,
      reason: 'watch_not_worn',
      enteredAt: new Date().toISOString(),
    };
    await submitManualOverride(override);
    setShowOverrideModal(false);
  };

  const recoveryColors = {
    good: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Ready to Train' },
    moderate: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Moderate Recovery' },
    low: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Recovery Needed' },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
            HealthKit Sync <Watch className="text-amber-500" size={24} />
          </h2>
          <p className="text-zinc-500 mt-1 font-medium text-sm">
            Biometrics, strain, and dynamic macro targets.
          </p>
        </div>
        <button
          onClick={triggerSync}
          disabled={isSyncing}
          className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 text-white px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {syncError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400 font-bold">
          Sync Error: {syncError}
        </div>
      )}

      {/* Missed Watch Alert */}
      {missedWatchDetected && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-start gap-4">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={22} />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-400">
              Watch not detected during today's {missedSessionTypes.join(' + ')} session
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Active energy seems too low for the workout you logged. Add a manual estimate so your macros calibrate correctly.
            </p>
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setShowOverrideModal(true)}
                className="bg-amber-500 text-black px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest"
              >
                Estimate Energy
              </button>
              <button
                onClick={dismissMissedWatch}
                className="bg-zinc-800 text-zinc-400 px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Biometric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BiometricCard
          icon={<Flame size={18} />}
          label="Active Energy"
          value={activeEnergyToday}
          unit="kcal"
          color="amber"
          history={biometricHistory.map(b => b.activeEnergyBurned || 0)}
        />
        <BiometricCard
          icon={<Activity size={18} />}
          label="HRV"
          value={todaysBiometrics?.hrv || 0}
          unit="ms"
          color="emerald"
          history={biometricHistory.map(b => b.hrv || 0)}
          higherIsBetter
        />
        <BiometricCard
          icon={<Heart size={18} />}
          label="Resting HR"
          value={todaysBiometrics?.restingHeartRate || 0}
          unit="bpm"
          color="red"
          history={biometricHistory.map(b => b.restingHeartRate || 0)}
          higherIsBetter={false}
        />
        <BiometricCard
          icon={<Moon size={18} />}
          label="Sleep"
          value={todaysBiometrics?.sleepHours || 0}
          unit="hrs"
          color="blue"
          history={biometricHistory.map(b => b.sleepHours || 0)}
          higherIsBetter
          decimals={1}
        />
      </div>

      {/* Strain + Recovery Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strain Level */}
        <div className={cn(
          'p-6 rounded-[2rem] border transition-all',
          STRAIN_COLORS[strainLevel].bg,
          'border-zinc-800/50',
          STRAIN_COLORS[strainLevel].glow && `shadow-lg ${STRAIN_COLORS[strainLevel].glow}`
        )}>
          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
            Today's Strain
          </div>
          <div className={cn('text-2xl font-black uppercase tracking-tight', STRAIN_COLORS[strainLevel].text)}>
            {STRAIN_LABELS[strainLevel]}
          </div>
          <div className="flex gap-1 mt-3">
            {(['rest', 'low', 'moderate', 'high', 'extreme'] as StrainLevel[]).map((level, i) => (
              <div
                key={level}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i <= ['rest', 'low', 'moderate', 'high', 'extreme'].indexOf(strainLevel)
                    ? STRAIN_COLORS[strainLevel].text.replace('text-', 'bg-')
                    : 'bg-zinc-800'
                )}
              />
            ))}
          </div>
          {todaysMacros?.adjustmentReason && (
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
              {todaysMacros.adjustmentReason}
            </p>
          )}
        </div>

        {/* Recovery Readiness */}
        <div className={cn(
          'p-6 rounded-[2rem] border border-zinc-800/50',
          recoveryColors[recoveryReadiness].bg
        )}>
          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
            Recovery Readiness
          </div>
          <div className={cn('text-2xl font-black uppercase tracking-tight', recoveryColors[recoveryReadiness].text)}>
            {recoveryColors[recoveryReadiness].label}
          </div>
          {todaysBiometrics?.sleepStages && (
            <div className="flex gap-3 mt-4">
              <SleepStage label="Deep" minutes={todaysBiometrics.sleepStages.deep} color="indigo" />
              <SleepStage label="REM" minutes={todaysBiometrics.sleepStages.rem} color="purple" />
              <SleepStage label="Core" minutes={todaysBiometrics.sleepStages.core} color="blue" />
              <SleepStage label="Awake" minutes={todaysBiometrics.sleepStages.awake} color="zinc" />
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Macro Targets */}
      {todaysMacros && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-[2rem] space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">
              Today's Macro Targets
            </h3>
            {todaysMacros.calorieAdjustment !== 0 && (
              <span className={cn(
                'text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest',
                todaysMacros.calorieAdjustment > 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}>
                {todaysMacros.calorieAdjustment > 0 ? '+' : ''}
                {todaysMacros.calorieAdjustment} kcal adjusted
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MacroCard
              icon={<Flame size={16} />}
              label="Calories"
              base={todaysMacros.baseCalories}
              adjusted={todaysMacros.adjustedCalories}
              unit="kcal"
              color="amber"
            />
            <MacroCard
              icon={<Beef size={16} />}
              label="Protein"
              base={todaysMacros.baseProteinG}
              adjusted={todaysMacros.adjustedProteinG}
              unit="g"
              color="red"
            />
            <MacroCard
              icon={<Wheat size={16} />}
              label="Carbs"
              base={todaysMacros.baseCarbsG}
              adjusted={todaysMacros.adjustedCarbsG}
              unit="g"
              color="amber"
            />
            <MacroCard
              icon={<Droplets size={16} />}
              label="Fat"
              base={todaysMacros.baseFatG}
              adjusted={todaysMacros.adjustedFatG}
              unit="g"
              color="purple"
            />
          </div>
        </div>
      )}

      {/* Export Workouts to Apple Health */}
      {todaysLogs.filter(l => l.type !== 'weight').length > 0 && (
        <div className="bg-zinc-900/30 border border-zinc-800/30 p-6 rounded-[2rem]">
          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">
            Export to Apple Health
          </h3>
          <div className="space-y-3">
            {todaysLogs.filter(l => l.type !== 'weight').map((log, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <div>
                  <div className="text-sm font-bold text-white">
                    {log.type === 'bjj' ? 'BJJ Session' : log.exercise}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                    {log.type === 'bjj' ? 'Martial Arts' : 'Functional Strength'} &middot; {log.type === 'bjj' ? `${log.rounds || 0} rounds` : `${log.sets?.length || 0} sets`}
                  </div>
                </div>
                <button
                  onClick={() => exportWorkout(log, log.type === 'bjj' ? 90 : 60)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2"
                >
                  <Zap size={12} /> Export
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowOverrideModal(false)} />
          <div className="relative bg-[#1A1A1A] border border-zinc-800 w-full max-w-md rounded-[2rem] p-8 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                Manual Energy Estimate
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-zinc-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Your Apple Watch wasn't detected during today's session.
              Estimate the duration so we can calibrate your macros.
            </p>

            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">
                Session Duration (minutes)
              </label>
              <input
                type="number"
                value={overrideDuration}
                onChange={(e) => setOverrideDuration(parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-zinc-600 mt-2">
                Estimated burn: ~{Math.round(overrideDuration * 8.5)} kcal
              </p>
            </div>

            <button
              onClick={handleManualOverride}
              className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs"
            >
              Apply Estimate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function BiometricCard({
  icon, label, value, unit, color, history, higherIsBetter = true, decimals = 0
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  color: string;
  history: number[];
  higherIsBetter?: boolean;
  decimals?: number;
}) {
  const trend = history.length >= 2
    ? history[0] - history[history.length - 1]
    : 0;
  const trendPositive = higherIsBetter ? trend > 0 : trend < 0;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 p-5 rounded-[1.5rem] space-y-3">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-xl bg-${color}-500/10 text-${color}-400`}>
          {icon}
        </div>
        {trend !== 0 && (
          <div className={cn('flex items-center gap-1 text-[10px] font-bold',
            trendPositive ? 'text-emerald-400' : 'text-red-400'
          )}>
            {trendPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(decimals)}
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-black text-white tracking-tight">
          {value.toFixed(decimals)}
          <span className="text-sm text-zinc-500 ml-1 font-bold">{unit}</span>
        </div>
        <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">
          {label}
        </div>
      </div>

      {/* Sparkline */}
      {history.length > 1 && (
        <div className="flex items-end gap-0.5 h-6">
          {history.slice(-7).reverse().map((v, i) => {
            const max = Math.max(...history);
            const min = Math.min(...history);
            const range = max - min || 1;
            const height = ((v - min) / range) * 100;
            return (
              <div
                key={i}
                className={cn('flex-1 rounded-sm transition-all', `bg-${color}-500/40`)}
                style={{ height: `${Math.max(10, height)}%` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MacroCard({
  icon, label, base, adjusted, unit, color
}: {
  icon: React.ReactNode;
  label: string;
  base: number;
  adjusted: number;
  unit: string;
  color: string;
}) {
  const diff = adjusted - base;
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-${color}-400`}>{icon}</span>
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-xl font-black text-white">
        {adjusted}
        <span className="text-xs text-zinc-500 ml-1">{unit}</span>
      </div>
      {diff !== 0 && (
        <div className={cn(
          'text-[10px] font-bold mt-1',
          diff > 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {diff > 0 ? '+' : ''}{diff} from base ({base})
        </div>
      )}
    </div>
  );
}

function SleepStage({ label, minutes, color }: { label: string; minutes: number; color: string }) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return (
    <div className="flex-1 text-center">
      <div className={`text-sm font-black text-${color}-400`}>
        {hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`}
      </div>
      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}
