import { FC, useState } from 'react';
import { History, ChevronRight, Trash2 } from 'lucide-react';
import { Ride } from '../types';
import { formatDistance, formatDuration } from '../lib/utils';
import { motion } from 'motion/react';
import { ConfirmationModal } from './ConfirmationModal';

interface HistoryScreenProps {
  rides: Ride[];
  isLoading?: boolean;
  onClose: () => void;
  onSelectRide: (ride: Ride) => void;
  onDeleteRide: (rideId: string) => Promise<void>;
  onShowMonthly: () => void;
}

const RideSkeleton = () => (
  <div className="bg-bento-card border border-bento-border rounded-2xl overflow-hidden p-4 md:p-6 flex flex-col gap-3 animate-pulse">
    <div className="flex justify-between items-start">
      <div className="h-4 w-24 bg-white/5 rounded"></div>
      <div className="h-4 w-16 bg-white/5 rounded"></div>
    </div>
    <div className="h-12 w-32 bg-white/5 rounded mt-1"></div>
    <div className="flex justify-between items-end border-t border-white/5 pt-3 mt-2">
      <div className="h-3 w-16 bg-white/5 rounded"></div>
      <div className="h-6 w-16 bg-white/5 rounded"></div>
    </div>
  </div>
);

export const HistoryScreen: FC<HistoryScreenProps> = ({ rides, isLoading, onClose, onSelectRide, onDeleteRide, onShowMonthly }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await onDeleteRide(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        className="absolute inset-0 bg-bento-bg z-[9999] flex flex-col p-safe pt-6 overflow-hidden"
      >
      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-6 px-4 md:px-6 shrink-0 gap-2">
        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
          <History size={32} className="text-bento-orange" />
          Ride Logs
        </h2>
        <div className="flex items-center gap-3">
           <button 
             onClick={onShowMonthly}
             className="bg-bento-orange/10 hover:bg-bento-orange/20 text-bento-orange px-4 py-3 text-xs tracking-widest font-bold uppercase rounded-2xl border border-bento-orange/30 transition-colors active:scale-90"
           >
             Monthly
           </button>
           <button 
             onClick={onClose}
             className="bg-white/5 hover:bg-white/10 p-3 w-12 h-12 flex items-center justify-center rounded-2xl border border-white/10 transition-colors active:scale-90 touch-manipulation"
           >
             <ChevronRight size={24} className="text-white" />
           </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 md:px-6 pb-24 no-scrollbar">
        {isLoading ? (
          <>
            <RideSkeleton />
            <RideSkeleton />
            <RideSkeleton />
          </>
        ) : rides.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-800">
            <History size={64} className="mb-4 opacity-10" />
            <p className="font-mono text-sm tracking-widest italic uppercase">Zero sessions detected</p>
          </div>
        ) : (
          rides.sort((a,b) => b.startTime - a.startTime).map(ride => (
            <div 
              key={ride.id}
              className="bg-bento-card border border-bento-border rounded-2xl overflow-hidden flex transition-all hover:border-bento-orange/30 shadow-lg relative"
            >
              {/* Delete Action - Isolated from main click area */}
              <div className="absolute top-4 right-4 z-[50]">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deletingId) return;
                    setConfirmDeleteId(ride.id);
                  }}
                  disabled={deletingId === ride.id}
                  className={`
                    w-10 h-10 flex items-center justify-center rounded-xl transition-all
                    ${deletingId === ride.id 
                      ? "bg-red-500/20 text-red-500 animate-pulse" 
                      : "text-zinc-600 hover:text-white hover:bg-red-500 active:scale-90"}
                  `}
                  title="Delete Ride"
                >
                  {deletingId === ride.id ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Trash2 size={18} />
                  )}
                </button>
              </div>

              <div 
                className="flex-1 p-4 md:p-6 cursor-pointer hover:bg-white/[0.02] transition-colors flex flex-col gap-3"
                onClick={() => onSelectRide(ride)}
              >
                {/* Top Row: Date, Status pill */}
                <div className="flex flex-wrap justify-between items-start gap-2 pr-12">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] md:text-xs font-mono text-zinc-500 tracking-widest uppercase whitespace-nowrap">
                      {new Date(ride.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {ride.status === 'recording' ? (
                      <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest flex items-center gap-1.5 animate-pulse uppercase whitespace-nowrap">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mb-[1px]"></div> REC
                      </span>
                    ) : (
                      <span className="bg-white/5 text-zinc-400 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase whitespace-nowrap">
                        Completed
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Row: Large Distance Text */}
                <div className="text-4xl md:text-5xl font-black text-white tracking-tighter italic">
                  {formatDistance(ride.distance)}
                </div>

                {/* Bottom Row: Speed & Sync Status & Time isolated from delete area */}
                <div className="flex flex-wrap justify-between items-end gap-2 border-t border-white/5 pt-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] md:text-xs font-bold text-zinc-500 tracking-widest uppercase font-mono whitespace-nowrap">
                      Ø {Math.round(ride.avgSpeed * 3.6)} km/h
                    </span>
                    <span className="text-[10px] md:text-xs font-bold text-bento-orange tracking-widest uppercase font-mono mt-1">
                      {formatDuration(Math.floor(((ride.endTime || Date.now()) - ride.startTime) / 1000))}
                    </span>
                  </div>
                  {/* Firebase-managed rides are always synced under the hood */}
                  <div className="flex items-center gap-2 px-2 py-1 bg-green-500/5 rounded-lg border border-green-500/10 transition-colors group-hover:border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                    <span className="text-[9px] md:text-[10px] text-zinc-400 font-mono tracking-widest uppercase font-bold">
                      Synced
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>

    <ConfirmationModal
      isOpen={!!confirmDeleteId}
      title="Purge Ride Log?"
      message="This will permanently delete the sessions metadata and all associated GPS telemetry points. This action cannot be undone."
      confirmLabel="Delete Log"
      cancelLabel="Cancel"
      onConfirm={handleDeleteConfirm}
      onCancel={() => setConfirmDeleteId(null)}
    />
  </>
);
}
