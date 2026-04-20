export interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null; // in m/s
  accuracy: number;
  timestamp: number;
  heading?: number | null; // useful for cornering math fallback
  leanAngle?: number; // from gyro
}

export interface SpeedDistribution {
  range: string;
  timeSec: number;
  percentage: number;
}

export interface Ride {
  id: string;
  userId: string;
  startTime: number;
  endTime: number | null;
  distance: number;
  maxSpeed: number;
  avgSpeed: number;
  points: LocationPoint[]; // We'll still keep this in memory for the active ride
  snapshotUrl: string | null;
  status: 'recording' | 'completed';
  // New Analytics Fields
  maxLeanAngle?: number; 
  efficiencyScore?: number; // 0-100
  speedDistribution?: SpeedDistribution[];
  isSynced?: boolean;
  syncError?: string;
}

export interface UserSettings {
  speedThreshold: number; // km/h
  autoStartEnabled: boolean;
  unit: 'metric' | 'imperial';
}
