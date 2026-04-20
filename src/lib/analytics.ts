import { LocationPoint, SpeedDistribution } from '../types';

export function calculateAnalytics(points: LocationPoint[], maxLeanAngleValue: number) {
  let efficiencyScore = 100;
  
  const distribution: Record<string, number> = {
    '0-30': 0,
    '30-60': 0,
    '60-90': 0,
    '90-120': 0,
    '120+': 0,
  };

  if (points.length < 2) {
    return {
      efficiencyScore: 0,
      speedDistribution: Object.keys(distribution).map(k => ({ range: k, timeSec: 0, percentage: 0 })),
      maxLeanAngle: maxLeanAngleValue
    };
  }

  let totalTimeSec = 0;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    
    // Time delta in seconds
    const dt = (p2.timestamp - p1.timestamp) / 1000;
    if (dt <= 0 || dt > 10) continue; // Ignore massive gaps/pauses

    totalTimeSec += dt;

    // Speed in km/h
    const v1 = (p1.speed || 0) * 3.6;
    const v2 = (p2.speed || 0) * 3.6;
    const avgV = (v1 + v2) / 2;

    // Bucket into speed distribution
    if (avgV < 30) distribution['0-30'] += dt;
    else if (avgV < 60) distribution['30-60'] += dt;
    else if (avgV < 90) distribution['60-90'] += dt;
    else if (avgV < 120) distribution['90-120'] += dt;
    else distribution['120+'] += dt;

    // Calculate acceleration/deceleration penalities for efficiency (smoothness)
    const deltaV = Math.abs(v2 - v1);
    const accelRate = deltaV / dt; 
    
    // Jerk / hard braking penalty (e.g., changing speed by more than 15 km/h per second)
    if (accelRate > 15) {
      efficiencyScore -= (accelRate * 0.1); 
    }
  }

  // Smooth out efficiency bounds
  efficiencyScore = Math.max(0, Math.min(100, Math.round(efficiencyScore)));

  // Convert distribution to array sorted by percentage
  const speedDistribution: SpeedDistribution[] = Object.keys(distribution).map(range => ({
    range,
    timeSec: Math.round(distribution[range]),
    percentage: totalTimeSec > 0 ? Math.round((distribution[range] / totalTimeSec) * 100) : 0
  }));

  // Device orientation fallback (if it was somehow null)
  const maxLeanAngle = maxLeanAngleValue || 0;

  return {
    efficiencyScore,
    speedDistribution,
    maxLeanAngle,
  };
}
