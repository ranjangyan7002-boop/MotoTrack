import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Calendar as CalendarIcon, TrendingUp, Navigation, Timer } from 'lucide-react';
import { Ride } from '../types';
import { formatDistance, formatDuration } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MonthlyStatsScreenProps {
  rides: Ride[];
  onClose: () => void;
}

export const MonthlyStatsScreen: React.FC<MonthlyStatsScreenProps> = ({ rides, onClose }) => {
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; distance: number; time: number; speedSum: number; count: number, sortKey: string }> = {};

    rides.filter(r => r.status === 'completed').forEach(r => {
      const date = new Date(r.startTime);
      const m = date.toLocaleString('default', { month: 'short' });
      const y = date.getFullYear();
      const key = `${m} ${y}`;
      const sortKey = `${y}-${date.getMonth().toString().padStart(2, '0')}`;

      if (!data[key]) {
        data[key] = { month: key, distance: 0, time: 0, speedSum: 0, count: 0, sortKey };
      }

      data[key].distance += r.distance;
      data[key].time += Math.floor(((r.endTime || Date.now()) - r.startTime) / 1000);
      data[key].speedSum += r.avgSpeed;
      data[key].count++;
    });

    return Object.values(data)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(d => ({
        ...d,
        avgSpeed: d.count > 0 ? (d.speedSum / d.count) * 3.6 : 0,
      }));
  }, [rides]);

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="absolute inset-0 bg-bento-bg z-[10000] flex flex-col p-safe pt-6 overflow-hidden md:p-6"
    >
      <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-6 px-4 md:px-0 shrink-0">
        <button 
          onClick={onClose}
          className="bg-white/5 hover:bg-white/10 p-3 w-12 h-12 flex items-center justify-center rounded-2xl border border-white/10 transition-colors active:scale-90 touch-manipulation"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>
        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
          Monthly Analytics
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-0 pb-24 no-scrollbar space-y-6">
        
        {monthlyData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-800">
            <CalendarIcon size={64} className="mb-4 opacity-10" />
            <p className="font-mono text-sm tracking-widest italic uppercase">No history available</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="h-64 bg-bento-card border border-bento-border rounded-2xl p-4 shadow-xl">
              <h3 className="text-xs font-mono text-zinc-500 uppercase flex items-center gap-2 mb-4"><TrendingUp size={14}/> Distance per month</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" stroke="#52525B" tick={{fill: '#A1A1AA', fontSize: 10}} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                    contentStyle={{backgroundColor: '#151518', borderColor: '#2A2A2E', borderRadius: '12px'}}
                    itemStyle={{color: '#FF8C00', fontWeight: 'bold'}}
                  />
                  <Bar dataKey="distance" fill="#FF8C00" radius={[4, 4, 0, 0]} name="Distance (m)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              {monthlyData.slice().reverse().map(data => (
                <div key={data.month} className="bg-bento-card border border-bento-border rounded-2xl p-5 break-inside-avoid">
                  <div className="flex justify-between items-center mb-4">
                     <h4 className="text-lg font-black text-white italic">{data.month}</h4>
                     <span className="text-xs font-mono text-zinc-500 bg-white/5 px-2 py-1 rounded">{data.count} sessions</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/5 rounded-lg p-3">
                      <Navigation size={14} className="text-zinc-500 mx-auto mb-1" />
                      <div className="font-bold text-white text-sm whitespace-nowrap">{formatDistance(data.distance)}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <Timer size={14} className="text-zinc-500 mx-auto mb-1" />
                      <div className="font-bold text-white text-sm whitespace-nowrap">{formatDuration(data.time)}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <TrendingUp size={14} className="text-zinc-500 mx-auto mb-1" />
                      <div className="font-bold text-white text-sm whitespace-nowrap">{Math.round(data.avgSpeed)}<span className="text-[10px] text-zinc-500 ml-1">km/h</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
