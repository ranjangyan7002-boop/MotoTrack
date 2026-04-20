import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Navigation, Zap, Calendar, TrendingUp, Activity } from 'lucide-react';
import { Ride } from '../types';
import { formatDistance, formatDuration } from '../lib/utils';
import { calculateAnalytics } from '../lib/analytics';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { RideMap } from './RideMap';

interface SummaryScreenProps {
  ride: Ride;
  onClose: () => void;
}

const COLORS = ['#FF8C00', '#F5A623', '#F8E71C', '#7ED321', '#4A90E2'];

export const SummaryScreen: React.FC<SummaryScreenProps> = ({ ride, onClose }) => {
  const [metrics, setMetrics] = useState({
    efficiencyScore: ride.efficiencyScore || 0,
    speedDistribution: ride.speedDistribution || [],
    maxLeanAngle: ride.maxLeanAngle || 0,
  });

  useEffect(() => {
    // If not calculated yet or loaded from history before points were stripped
    if ((!ride.efficiencyScore || !ride.speedDistribution) && ride.points?.length > 0) {
      const res = calculateAnalytics(ride.points, ride.maxLeanAngle || 0);
      setMetrics(res);
    }
  }, [ride]);

  const maxKmh = Math.round(ride.maxSpeed * 3.6);
  const avgKmh = Math.round(ride.avgSpeed * 3.6);
  const rideDuration = Math.floor(((ride.endTime || Date.now()) - ride.startTime) / 1000);

  const hasChartData = metrics.speedDistribution.some(d => d.percentage > 0);
  const hasPoints = ride.points && ride.points.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 bg-bento-bg z-[10000] p-4 md:p-6 overflow-y-auto pt-safe pb-safe no-scrollbar flex flex-col"
    >
      <div className="flex-1 space-y-4 md:space-y-6 max-w-4xl mx-auto w-full pt-4 md:pt-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-bento-orange/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-bento-orange/30 shadow-[0_0_30px_rgba(255,140,0,0.2)]">
            <Activity className="text-bento-orange w-8 h-8" />
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase mb-2">
            Mission Complete
          </h2>
          <p className="text-zinc-500 font-mono text-xs md:text-sm tracking-widest uppercase">
            Data synced to secure vault
          </p>
        </div>

        {/* Hero Section: Map Visualization */}
        <div className="relative h-56 md:h-80 rounded-3xl overflow-hidden border border-white/10 bg-zinc-900 shadow-2xl group ring-1 ring-white/5">
          {hasPoints ? (
            <div className="w-full h-full pointer-events-none">
              <RideMap points={ride.points} isTracking={false} fitBounds={true} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-6 left-6 flex items-center gap-3 z-20">
                 <div className="w-10 h-10 bg-bento-orange rounded-xl flex items-center justify-center shadow-lg">
                    <MapPin className="text-black w-5 h-5" />
                 </div>
                 <div>
                    <div className="text-[10px] font-mono text-white/50 tracking-widest uppercase">Route Telemetry</div>
                    <div className="text-sm font-bold text-white uppercase tracking-tight">Active Replay</div>
                 </div>
              </div>
            </div>
          ) : ride.snapshotUrl ? (
            <>
              <img 
                src={ride.snapshotUrl} 
                alt="Ride Map Route" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-6 left-6 flex items-center gap-3">
                 <div className="w-10 h-10 bg-bento-orange rounded-xl flex items-center justify-center shadow-lg">
                    <MapPin className="text-black w-5 h-5" />
                 </div>
                 <div>
                    <div className="text-[10px] font-mono text-white/50 tracking-widest uppercase">Route Telemetry</div>
                    <div className="text-sm font-bold text-white uppercase tracking-tight">Session Visualizer</div>
                 </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 bg-zinc-900/50">
              <MapPin size={64} className="mb-4 opacity-10" />
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-30">Map Snapshot Unavailable</p>
            </div>
          )}
        </div>

        {/* Primary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <SummaryCard label="Distance" value={formatDistance(ride.distance)} icon={<Navigation className="text-bento-orange w-5 h-5" />} />
          <SummaryCard label="Duration" value={formatDuration(rideDuration)} icon={<Calendar className="text-zinc-400 w-5 h-5" />} />
          <SummaryCard label="Avg Speed" value={`${avgKmh} km/h`} icon={<Zap className="text-green-400 w-5 h-5" />} />
          <SummaryCard label="Max Speed" value={`${maxKmh} km/h`} icon={<TrendingUp className="text-red-400 w-5 h-5" />} />
        </div>

        {/* New Analytics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Advanced Telemetry Box */}
          <div className="bg-bento-card border border-bento-border p-5 rounded-2xl shadow-lg flex flex-col justify-between">
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Advanced Telemetry</h3>
            <div className="flex justify-between items-end">
               <div>
                  <div className="text-[10px] text-zinc-500 font-bold mb-1">EFFICIENCY SCORE</div>
                  <div className="text-4xl font-black italic text-white">{metrics.efficiencyScore}<span className="text-sm font-mono text-zinc-500 not-italic">/100</span></div>
               </div>
               <div className="text-right">
                  <div className="text-[10px] text-zinc-500 font-bold mb-1">MAX LEAN (EST)</div>
                  <div className="text-4xl font-black italic text-bento-orange">{metrics.maxLeanAngle.toFixed(1)}°</div>
               </div>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full mt-4 overflow-hidden">
               <div className="h-full bg-bento-orange rounded-full transition-all duration-1000" style={{width: `${metrics.efficiencyScore}%`}}></div>
            </div>
          </div>

          {/* Speed Distribution Chart */}
          <div className="bg-bento-card border border-bento-border p-5 rounded-2xl shadow-lg flex flex-col h-48 md:h-auto min-h-[192px]">
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 flex-shrink-0">Speed Distribution</h3>
            <div className="flex-1 w-full relative min-h-0">
               {hasChartData ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={metrics.speedDistribution.filter(d => d.percentage > 0)}
                       cx="50%"
                       cy="50%"
                       innerRadius={40}
                       outerRadius={65}
                       paddingAngle={2}
                       dataKey="percentage"
                     >
                       {metrics.speedDistribution.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <RechartsTooltip 
                        formatter={(value: number, name: string) => [`${value}%`, `Range: ${name} km/h`]}
                        contentStyle={{backgroundColor: '#151518', borderColor: '#2A2A2E', borderRadius: '8px', fontSize: '12px'}}
                        itemStyle={{color: '#fff'}}
                     />
                   </PieChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600 font-mono">Insufficient Data</div>
               )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-bento-orange text-black font-black rounded-[14px] border-none pl-px pt-2.5 pb-2.5 mb-2.5 tracking-widest uppercase hover:bg-orange-400 transition-all active:scale-[0.98] mt-6"
        >
          BACK TO DASHBOARD
        </button>
      </div>
    </motion.div>
  );
};

const SummaryCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="bg-bento-card border border-bento-border p-4 md:p-5 rounded-2xl shadow-lg flex flex-col justify-between h-28 md:h-32">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-[10px] md:text-sm font-mono text-zinc-500 uppercase flex-1 truncate">{label}</span>
    </div>
    <div className="text-xl md:text-3xl font-black text-white italic tracking-tighter truncate">{value}</div>
  </div>
);
