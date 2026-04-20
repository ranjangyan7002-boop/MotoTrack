import React from 'react';
import { Activity, Zap, Timer, Navigation } from 'lucide-react';
import { formatDistance, formatDuration } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface StatsOverlayProps {
  currentSpeed: number;
  maxSpeed: number;
  distance: number;
  duration: number;
  isRecording: boolean;
  isFinishing?: boolean;
  overSpeed: boolean;
  onToggleRecording: () => void;
}

const Metric = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="text-[10px] md:text-xs font-mono text-zinc-500 tracking-widest uppercase">{label}</span>
      <span className="font-bold text-white text-sm md:text-base tabular-nums leading-none tracking-tight">{value}</span>
    </div>
  </div>
);

export const StatsOverlay: React.FC<StatsOverlayProps> = ({ currentSpeed, maxSpeed, distance, duration, isRecording, isFinishing, overSpeed, onToggleRecording }) => {
  const kmh = Math.round(currentSpeed * 3.6);
  const maxKmh = Math.round(maxSpeed * 3.6);

  return (
    <div className="absolute inset-x-0 bottom-4 md:bottom-0 md:relative z-[9999] md:z-auto flex flex-col md:w-80 shrink-0 gap-4 md:gap-6 px-4 md:px-0 safe-top flex-1 pointer-events-none md:pointer-events-auto overflow-y-auto no-scrollbar">
      {/* Live Speed Display - New Bento Box */}
      <div className="bg-bento-card border border-bento-border rounded-2xl p-4 md:p-5 flex flex-col justify-center items-center flex-[1.5] min-h-[160px] md:min-h-0 pointer-events-auto shadow-xl relative overflow-hidden">
        <div className="absolute top-4 left-4 md:top-5 md:left-5 text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-2">
            <Activity size={12} className="text-bento-orange animate-pulse" /> Live Telemetry
        </div>
        <div className="flex items-baseline gap-1 md:gap-2 mt-4 transition-all duration-300">
          <span className="text-6xl md:text-8xl font-black italic tracking-tighter text-white tabular-nums">{kmh}</span>
          <span className="text-lg md:text-xl font-bold text-zinc-500 tracking-widest uppercase">km/h</span>
        </div>
      </div>

      {/* Primary Metrics Bento */}
      <div className="bg-bento-card border border-bento-border rounded-2xl p-4 md:p-6 flex flex-col justify-between flex-1 pointer-events-auto shadow-xl min-h-[160px] md:min-h-0">
        <div className="flex justify-between items-start">
          <div className="uppercase text-[10px] tracking-widest text-zinc-500 font-bold">Current Session</div>
          {isRecording ? (
            <div className="px-2 py-1 bg-red-500/10 text-red-500 text-[10px] font-bold rounded border border-red-500/20 animate-pulse">RECORDING</div>
          ) : isFinishing ? (
            <div className="px-2 py-1 bg-bento-orange/10 text-bento-orange text-[10px] font-bold rounded border border-bento-orange/20 animate-pulse">SAVING...</div>
          ) : (
            <div className="px-2 py-1 bg-white/5 text-zinc-500 text-[10px] font-bold rounded border border-white/10 uppercase">Idle</div>
          )}
        </div>
        <div className="flex flex-row md:flex-col justify-between md:justify-start gap-4 md:gap-6 mt-4">
          <Metric label="DISTANCE" value={formatDistance(distance)} icon={<Navigation size={14} className="text-zinc-500" />} />
          <Metric label="DURATION" value={formatDuration(duration)} icon={<Timer size={14} className="text-zinc-500" />} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:gap-6 h-28 md:h-36 shrink-0">
        {/* Max Speed Bento */}
        <div className="bg-bento-card border border-bento-border rounded-2xl p-4 md:p-5 flex flex-col justify-center gap-1 pointer-events-auto h-full">
          <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-2 mb-1">
            <Zap size={12} /> Max Speed
          </div>
          <div className="text-3xl md:text-5xl font-black italic tracking-tighter text-white">{maxKmh}</div>
          <div className="text-[10px] md:text-xs text-zinc-600 font-mono italic underline decoration-bento-orange mt-1 truncate">Route Peak</div>
        </div>

        {/* Action Toggle Bento */}
        <button
          onClick={onToggleRecording}
          disabled={isFinishing}
          className={`pointer-events-auto rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 border border-bento-border h-full touch-manipulation select-none ${
            isFinishing
              ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50'
              : isRecording 
                ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20' 
                : 'bg-bento-orange/10 border-bento-orange/30 text-bento-orange hover:bg-bento-orange/20'
          }`}
        >
          {isFinishing ? (
            <>
              <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Saving...</span>
            </>
          ) : isRecording ? (
            <>
             <div className="w-5 h-5 bg-red-500 rounded-sm" />
             <span className="text-[10px] font-bold tracking-widest uppercase">Stop Ride</span>
            </>
          ) : (
            <>
              <Activity size={24} />
              <span className="text-[10px] font-bold tracking-widest uppercase">Start Ride</span>
            </>
          )}
        </button>
      </div>

      {/* Speedometer Widget (Only appears in Bento mode if needed elsewhere, but following User design) */}
      <AnimatePresence>
        {overSpeed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-red-500 text-black px-4 py-3 rounded-2xl font-black text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg animate-pulse pointer-events-none"
          >
            <Zap size={14} fill="currentColor" />
            CRITICAL: SPEED THRESHOLD EXCEEDED
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
