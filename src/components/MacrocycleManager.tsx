/**
 * Macrocycle Manager — 12-Week Timelapse & Progression Tracker
 *
 * Features:
 *   - Create/manage 12-week macrocycles
 *   - View archived weekly frames as a thumbnail grid
 *   - Generate 15-second MP4 timelapse from accumulated frames
 *   - Aggregate stats across the macrocycle (total lbs lost, BJJ hours, volume)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Play, Plus, Film, Calendar, TrendingDown, Clock,
  Dumbbell, Loader2, CheckCircle, X, Download, ChevronRight
} from 'lucide-react';
import { CreatorExportService, DEFAULT_TIMELAPSE_CONFIG } from '../services/CreatorExportService';
import { Macrocycle, TimelapseConfig } from '../types';
import { cn } from '../lib/utils';

interface MacrocycleManagerProps {
  appId: string;
  userId: string;
  userEmail: string;
}

export default function MacrocycleManager({ appId, userId, userEmail }: MacrocycleManagerProps) {
  const [macrocycle, setMacrocycle] = useState<Macrocycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingTimelapse, setIsGeneratingTimelapse] = useState(false);
  const [timelapseUrl, setTimelapseUrl] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [showFramePreview, setShowFramePreview] = useState<number | null>(null);
  const [timelapseConfig, setTimelapseConfig] = useState<TimelapseConfig>(DEFAULT_TIMELAPSE_CONFIG);

  const service = new CreatorExportService(appId, userId);

  useEffect(() => {
    loadMacrocycle();
  }, []);

  const loadMacrocycle = async () => {
    setIsLoading(true);
    const active = await service.getActiveMacrocycle();
    setMacrocycle(active);
    if (active?.timelapseVideoUrl) {
      setTimelapseUrl(active.timelapseVideoUrl);
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    const mc = await service.createMacrocycle(newName || undefined);
    setMacrocycle({ ...mc, userEmail });
    setShowCreateModal(false);
    setNewName('');
  };

  const handleGenerateTimelapse = async () => {
    if (!macrocycle?.id) return;
    setIsGeneratingTimelapse(true);
    try {
      const url = await service.generateTimelapse(macrocycle.id, timelapseConfig);
      setTimelapseUrl(url);
    } catch (err) {
      console.error('Timelapse generation failed:', err);
    } finally {
      setIsGeneratingTimelapse(false);
    }
  };

  const handleDownloadTimelapse = () => {
    if (!timelapseUrl) return;
    const link = document.createElement('a');
    link.href = timelapseUrl;
    link.download = `matforge-macrocycle-${macrocycle?.name || 'timelapse'}.webm`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  // No active macrocycle — show creation prompt
  if (!macrocycle) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
              Macrocycle <Film className="text-amber-500" size={24} />
            </h2>
            <p className="text-zinc-500 mt-1 font-medium text-sm">
              12-week progression tracking with auto-generated timelapses.
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-[3rem] p-12 flex flex-col items-center justify-center text-center space-y-6">
          <div className="p-6 bg-zinc-900/50 rounded-full border border-zinc-800">
            <Film size={48} strokeWidth={1} className="text-zinc-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-zinc-400 uppercase tracking-tighter">
              No Active Macrocycle
            </h3>
            <p className="text-sm text-zinc-600 max-w-sm mx-auto mt-2">
              Start a 12-week block to automatically archive your weekly summaries
              and generate a progression timelapse at the end.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-amber-500 hover:bg-amber-400 text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-amber-500/10 flex items-center gap-3"
          >
            <Plus size={16} /> Start Macrocycle
          </button>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <CreateModal
            name={newName}
            setName={setNewName}
            onCreate={handleCreate}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </div>
    );
  }

  // Active macrocycle — show progress
  const weeksFilled = macrocycle.frames?.length || 0;
  const progressPercent = (weeksFilled / 12) * 100;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
            {macrocycle.name || 'Macrocycle'} <Film className="text-amber-500" size={24} />
          </h2>
          <p className="text-zinc-500 mt-1 font-medium text-sm">
            Week {weeksFilled} of 12 &middot; {macrocycle.status === 'completed' ? 'Completed' : 'In Progress'}
          </p>
        </div>

        {weeksFilled >= 2 && (
          <button
            onClick={handleGenerateTimelapse}
            disabled={isGeneratingTimelapse}
            className="bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 text-black disabled:text-zinc-600 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2"
          >
            {isGeneratingTimelapse ? (
              <><Loader2 size={14} className="animate-spin" /> Generating...</>
            ) : (
              <><Play size={14} /> Generate Timelapse</>
            )}
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-[2rem] space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Macrocycle Progress
          </span>
          <span className="text-sm font-black text-amber-500">{weeksFilled}/12 weeks</span>
        </div>
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Aggregate Stats */}
      {weeksFilled > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<TrendingDown size={18} />}
            label="Total Lost"
            value={`${(macrocycle.totalPoundsLost || macrocycle.frames?.reduce((s, f) => s + f.metrics.poundsLost, 0) || 0).toFixed(1)} lbs`}
            color="emerald"
          />
          <StatCard
            icon={<Clock size={18} />}
            label="Total Mat Time"
            value={`${(macrocycle.totalBjjHours || macrocycle.frames?.reduce((s, f) => s + f.metrics.bjjHours, 0) || 0).toFixed(1)} hrs`}
            color="blue"
          />
          <StatCard
            icon={<Dumbbell size={18} />}
            label="Total Volume"
            value={`${Math.round(macrocycle.totalLiftingVolume || macrocycle.frames?.reduce((s, f) => s + f.metrics.liftingVolume, 0) || 0).toLocaleString()} lbs`}
            color="amber"
          />
        </div>
      )}

      {/* Frame Grid */}
      <div className="bg-zinc-900/30 border border-zinc-800/30 p-6 rounded-[2rem]">
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">
          Weekly Frames
        </h3>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => {
            const frame = macrocycle.frames?.[i];
            return (
              <div
                key={i}
                className={cn(
                  'aspect-square rounded-2xl border overflow-hidden transition-all cursor-pointer group',
                  frame
                    ? 'border-zinc-700 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5'
                    : 'border-zinc-800/50 border-dashed bg-zinc-900/30'
                )}
                onClick={() => frame && setShowFramePreview(i)}
              >
                {frame ? (
                  <div className="relative w-full h-full">
                    <img src={frame.imageUrl} alt={`Week ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-black text-xs">W{i + 1}</span>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded-md">
                      <span className="text-[8px] font-bold text-amber-500">{i + 1}</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-zinc-700 text-xs font-bold">{i + 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timelapse Video Preview */}
      {timelapseUrl && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-400" /> Timelapse Ready
            </h3>
            <button
              onClick={handleDownloadTimelapse}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2"
            >
              <Download size={12} /> Download MP4
            </button>
          </div>
          <video
            src={timelapseUrl}
            controls
            loop
            className="w-full rounded-2xl border border-zinc-800"
          />
        </div>
      )}

      {/* Timelapse Config */}
      <div className="bg-zinc-900/30 border border-zinc-800/30 p-6 rounded-[2rem] space-y-4">
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">
          Timelapse Settings
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ConfigOption
            label="Transition"
            value={timelapseConfig.transitionType}
            options={['crossfade', 'slide', 'zoom', 'none']}
            onChange={(v) => setTimelapseConfig(c => ({ ...c, transitionType: v as any }))}
          />
          <ConfigOption
            label="Duration"
            value={`${timelapseConfig.durationSeconds}s`}
            options={['10s', '15s', '20s', '30s']}
            onChange={(v) => setTimelapseConfig(c => ({ ...c, durationSeconds: parseInt(v) }))}
          />
          <ConfigOption
            label="Music"
            value={timelapseConfig.backgroundMusic || 'none'}
            options={['epic', 'chill', 'none']}
            onChange={(v) => setTimelapseConfig(c => ({ ...c, backgroundMusic: v as any }))}
          />
          <ConfigOption
            label="Overlay"
            value={timelapseConfig.includeMetricsOverlay ? 'On' : 'Off'}
            options={['On', 'Off']}
            onChange={(v) => setTimelapseConfig(c => ({ ...c, includeMetricsOverlay: v === 'On' }))}
          />
        </div>
      </div>

      {/* Frame Preview Modal */}
      {showFramePreview !== null && macrocycle.frames?.[showFramePreview] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowFramePreview(null)} />
          <div className="relative w-full max-w-2xl bg-[#1A1A1A] border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <img
              src={macrocycle.frames[showFramePreview].imageUrl}
              alt={`Week ${showFramePreview + 1}`}
              className="w-full aspect-square object-cover"
            />
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-amber-500 font-black text-xl uppercase tracking-tighter">
                  Week {showFramePreview + 1}
                </div>
                <div className="text-xs text-zinc-500 font-bold">
                  {new Date(macrocycle.frames[showFramePreview].weekEnding).toLocaleDateString(undefined, {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <MiniStat label="Lost" value={`${macrocycle.frames[showFramePreview].metrics.poundsLost.toFixed(1)} lbs`} />
                <MiniStat label="Mats" value={`${macrocycle.frames[showFramePreview].metrics.bjjHours}h`} />
                <MiniStat label="Volume" value={`${Math.round(macrocycle.frames[showFramePreview].metrics.liftingVolume).toLocaleString()}`} />
                <MiniStat label="Adherence" value={`${Math.round(macrocycle.frames[showFramePreview].metrics.caloricAdherence)}%`} />
              </div>
            </div>
            <button
              onClick={() => setShowFramePreview(null)}
              className="absolute top-6 right-6 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function CreateModal({
  name, setName, onCreate, onClose
}: {
  name: string;
  setName: (v: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1A1A] border border-zinc-800 w-full max-w-md rounded-[2rem] p-8 space-y-6 animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            New Macrocycle
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">
            Name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Spring 2026 Cut"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-amber-500 placeholder-zinc-700"
          />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
          <p><strong className="text-zinc-400">Duration:</strong> 12 weeks</p>
          <p><strong className="text-zinc-400">Start:</strong> {new Date().toLocaleDateString()}</p>
          <p><strong className="text-zinc-400">End:</strong> {new Date(Date.now() + 84 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
        </div>

        <button
          onClick={onCreate}
          className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs"
        >
          Start 12-Week Block
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={cn('p-5 rounded-[1.5rem] border border-zinc-800/50', `bg-${color}-500/5`)}>
      <div className={`text-${color}-400 mb-2`}>{icon}</div>
      <div className="text-lg font-black text-white tracking-tight">{value}</div>
      <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-black text-white">{value}</div>
      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{label}</div>
    </div>
  );
}

function ConfigOption({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest block mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
        ))}
      </select>
    </div>
  );
}
