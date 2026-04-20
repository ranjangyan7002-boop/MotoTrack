import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LogIn, Navigation, X, Map as MapIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { RideMap } from './components/RideMap';
import { StatsOverlay } from './components/StatsOverlay';
import { SummaryScreen } from './components/SummaryScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { MonthlyStatsScreen } from './components/MonthlyStatsScreen';
import { Ride, LocationPoint, UserSettings } from './types';
import { calculateAnalytics } from './lib/analytics';
import { getHaversineDistance } from './lib/utils';
import { auth, db } from './firebase';
import { firebaseService } from './services/firebaseService';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';

const googleProvider = new GoogleAuthProvider();
const AUTO_START_SPEED = 15; // km/h threshold to auto-start if settings enabled
const CRITICAL_SPEED = 130; 

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // App State
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [lastFinishedRide, setLastFinishedRide] = useState<Ride | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showMonthlyStats, setShowMonthlyStats] = useState(false);
  const [deletedRideIds, setDeletedRideIds] = useState<Set<string>>(new Set());
  const [deleteSuccessId, setDeleteSuccessId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Tracks if we manually stopped to avoid onSnapshot re-activating it
  const manualStopRef = useRef<string | null>(null);

  // Live Telemetry State
  const [currentSpeed, setCurrentSpeed] = useState(0); // m/s
  const [maxSpeed, setMaxSpeed] = useState(0); // m/s
  const [distance, setDistance] = useState(0); // meters
  const [duration, setDuration] = useState(0); // seconds
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [maxLeanAngle, setMaxLeanAngle] = useState(0);

  // Refs for stable metrics during recording to avoid dependency churn
  const distanceRef = useRef(0);
  const maxSpeedRef = useRef(0);
  const pointsRef = useRef<LocationPoint[]>([]);
  const maxLeanAngleRef = useRef(0);
  
  // Snapshot of points for the summary screen to ensure they don't get cleared before summary opens
  const summaryPointsRef = useRef<LocationPoint[]>([]);

  // UI State
  const [glowTrigger, setGlowTrigger] = useState(0);
  const [settings] = useState<UserSettings>({ speedThreshold: CRITICAL_SPEED, autoStartEnabled: false, unit: 'metric' });

  const watchId = useRef<number | null>(null);
  const overSpeed = (currentSpeed * 3.6) > settings.speedThreshold;

  // Timer Effect - Derived from activeRide.startTime for accuracy
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (activeRide && activeRide.startTime && !isFinishing) {
      // Sync local state if activeRide was loaded from DB
      setDuration(Math.floor((Date.now() - activeRide.startTime) / 1000));
      
      interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - activeRide.startTime) / 1000));
      }, 1000);
    } else if (!activeRide) {
      setDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeRide?.id, activeRide?.startTime, isFinishing]);

  // Firebase Auth & Connection Test
  useEffect(() => {
    // 1. Connection Test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'system', 'ping'));
      } catch (err: any) {
        if (err.code === 'unavailable' || err.message?.includes('offline')) {
          console.warn("Firestore appears offline. History may be stale.");
        }
      }
    };
    testConnection();

    // 2. Auth Listener
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  // Real-time Data Sync - Pure Firebase
  useEffect(() => {
    if (!user) {
      setRides([]);
      return;
    }

    setIsLoadingHistory(true);
    const unsubscribe = firebaseService.subscribeToRides(user.uid, (fetchedRides) => {
      setRides(fetchedRides);
      
      const activeFromCloud = fetchedRides.find(r => r.status === 'recording');
      
      // Real-time synchronization for the active session
      setActiveRide(prev => {
        // 1. If cloud has an active ride, use it as the source of truth
        if (activeFromCloud) {
          if (manualStopRef.current === activeFromCloud.id) return null;
          return activeFromCloud;
        }
        
        // 2. If cloud has NO active ride, but we are recording locally, keep it!
        // This prevents the "early sync" from clearing a just-started session.
        if (prev?.status === 'recording' && manualStopRef.current !== prev.id) {
          return prev;
        }
        
        return null;
      });
      
      setIsLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [user]);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => {
    setActiveRide(null);
    setPoints([]);
    pointsRef.current = [];
    signOut(auth);
  };

  // Hydrate Points & Metrics for Restored Active Ride (Survive Refresh)
  useEffect(() => {
    if (activeRide && pointsRef.current.length === 0 && !isFinishing) {
      // We have an active ride document but no memory trail -> Likely just refreshed
      const hydrate = async () => {
        try {
          if (!user) return;
          const pts = await firebaseService.fetchPoints(activeRide.id, user.uid);
          if (pts.length > 0) {
            pointsRef.current = pts;
            setPoints([...pts]);
            
            // Reconstruct metrics from doc + point trail
            if (activeRide.distance) {
              distanceRef.current = activeRide.distance;
              setDistance(activeRide.distance);
            }
            if (activeRide.maxSpeed) {
              maxSpeedRef.current = activeRide.maxSpeed;
              setMaxSpeed(activeRide.maxSpeed);
            }
            
            // Restore Max Lean from trail if available
            const lean = Math.max(...pts.map(p => p.leanAngle || 0), 0);
            maxLeanAngleRef.current = lean;
            setMaxLeanAngle(lean);
            
            console.log(`Hydrated ${pts.length} points for ride ${activeRide.id}`);
          }
        } catch (e) {
          console.error("Critical: Hydration failed during refresh recovery:", e);
        }
      };
      hydrate();
    }
  }, [activeRide?.id, !!user]);

  const startRecording = useCallback(async () => {
    if (!user || isFinishing || activeRide) return;
    
    const rideId = Math.random().toString(36).substring(2, 11);
    const startTime = Date.now();
    
    // Clear stop lock for new ride
    manualStopRef.current = null;
    
    const newRide: Ride = {
      id: rideId,
      userId: user.uid,
      startTime: startTime,
      endTime: null,
      distance: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      points: [],
      snapshotUrl: null,
      status: 'recording',
      isSynced: true, // Always synced with Firebase
    };

    try {
      setActiveRide(newRide);
      setGlowTrigger(prev => prev + 1);

      // Start Firebase ride
      await firebaseService.startRide(user.uid, startTime, rideId);
      
      // Reset local recording refs
      setPoints([]);
      pointsRef.current = [];
      summaryPointsRef.current = [];
      setDistance(0);
      distanceRef.current = 0;
      setMaxSpeed(0);
      maxSpeedRef.current = 0;
      setCurrentSpeed(0);
      setMaxLeanAngle(0);
      maxLeanAngleRef.current = 0;
      setDuration(0);
    } catch (e) {
      console.error(e);
    }
  }, [user, isFinishing]);

  const stopRecording = useCallback(async () => {
    if (!activeRide || !user || isFinishing) return;
    
    setIsFinishing(true);
    const currentRideId = activeRide.id;
    manualStopRef.current = currentRideId;

    const endTime = Date.now();
    const finalDistance = distanceRef.current;
    const finalMaxSpeed = maxSpeedRef.current;
    const finalPoints = [...pointsRef.current]; 
    const finalMaxLean = maxLeanAngleRef.current;
    const finalDuration = Math.floor((endTime - activeRide.startTime) / 1000);
    const finalAvgSpeed = finalDuration > 0 ? finalDistance / finalDuration : 0;
    
    summaryPointsRef.current = finalPoints;

    let snapshotUrl = null;
    if (finalPoints.length > 0) {
      snapshotUrl = `https://picsum.photos/seed/ride-${currentRideId}/600/400`;
    }

    const analytics = calculateAnalytics(finalPoints, finalMaxLean);

    // 1. Prepare the finished ride object for local state (Optimistic UI)
    const finishedRide: Ride = {
      ...activeRide,
      endTime,
      distance: finalDistance,
      maxSpeed: finalMaxSpeed,
      avgSpeed: finalAvgSpeed,
      points: finalPoints,
      snapshotUrl,
      status: 'completed',
      maxLeanAngle: analytics.maxLeanAngle,
      efficiencyScore: analytics.efficiencyScore,
      speedDistribution: analytics.speedDistribution,
      isSynced: false,
    };

    // 2. Clear active state and show summary IMMEDIATELY
    setActiveRide(null);
    setLastFinishedRide(finishedRide);
    setRides(prev => [finishedRide, ...prev.filter(r => r.id !== finishedRide.id)]);
    
    // Clear dashboard stats immediately so it doesn't look like it's "still going"
    setDuration(0);
    setDistance(0);
    setMaxSpeed(0);
    setPoints([]);
    setMaxLeanAngle(0);
    setIsFinishing(false); // Clear saving state immediately to let user interact with dashboard

    // 3. Perform final sync (no await to keep UI snappy, Firestore handles offline automatically)
    (async () => {
      try {
        await firebaseService.finishRide(currentRideId, finishedRide);
        
        // Save final batch of points if any (Redundancy check, Firestore handles duplicates via offline sync if we had unique IDs, but here we addDoc)
        for (const point of pointsRef.current) {
          firebaseService.savePoint(currentRideId, user.uid, point);
        }
      } catch (e) {
        console.error("Critical: Failed to sync ride to cloud in background:", e);
      }
    })();
  }, [activeRide, user, isFinishing]);

  // GPS Tracking
  useEffect(() => {
    if (!user) return;

    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed, accuracy, altitude, heading } = position.coords;
          const ts = position.timestamp;
          
          const currentPoint: LocationPoint = {
            latitude,
            longitude,
            speed: speed || 0,
            accuracy,
            altitude,
            heading,
            timestamp: ts,
          };

          const kmh = (speed || 0) * 3.6;
          setCurrentSpeed(speed || 0);

          if (!activeRide && settings.autoStartEnabled && kmh > AUTO_START_SPEED) {
             startRecording();
          }

          if (activeRide) {
            // Update points ref and state
            pointsRef.current.push(currentPoint);
            setPoints([...pointsRef.current]);

            // Real-time sync for Firestore - ONLY update doc occasionally to save battery/quota
            firebaseService.savePoint(activeRide.id, user.uid, currentPoint)
              .catch(e => console.error("Firestore point error:", e));

            // Throttle Metadata Updates (distance/speed) every 5 points to prevent flickering & high writes
            if (pointsRef.current.length % 5 === 0) {
               firebaseService.updateRideStats(activeRide.id, {
                 distance: distanceRef.current,
                 maxSpeed: maxSpeedRef.current,
                 avgSpeed: duration > 0 ? distanceRef.current / duration : 0
               }).catch(e => console.error("Stats sync error:", e));
            }

            // Update distance
            const prevPoints = pointsRef.current;
            if (prevPoints.length > 1) {
              const last = prevPoints[prevPoints.length - 2];
              const step = getHaversineDistance(last.latitude, last.longitude, latitude, longitude);
              if (step < 500 && accuracy < 50) {
                distanceRef.current += step;
                setDistance(distanceRef.current);
              }
            }
            
            // Update max speed
            if (speed && speed > maxSpeedRef.current) {
              maxSpeedRef.current = speed;
              setMaxSpeed(speed);
            }
          }
        },
        (error) => console.error(error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [user, !!activeRide, settings.autoStartEnabled]);

  // Device Orientation Listener for Lean Angle
  useEffect(() => {
    if (!activeRide) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      let lean = 0;
      if (event.beta && event.gamma) {
        lean = Math.max(Math.abs(event.beta), Math.abs(event.gamma));
        if (lean > 90) lean = 180 - lean; // normalize
      }
      
      if (lean > maxLeanAngleRef.current) {
        maxLeanAngleRef.current = lean;
        setMaxLeanAngle(lean);
      }
    };

    // Note: iOS 13+ requires permission. Usually handled via a button click first.
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      // We'll passively listen if permission was already granted previously, 
      // but typically we'd need a UI affordance to request it.
      window.addEventListener("deviceorientation", handleOrientation);
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [activeRide, maxLeanAngle]);

  // Add resize listener for map when mobile map toggled
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [showMobileMap]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-bento-bg flex items-center justify-center p-6 bg-[radial-gradient(circle_at_50%_40%,#F27D2615,transparent_60%)]">
        <div className="w-16 h-16 border-t-2 border-bento-orange rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-6 bg-[radial-gradient(circle_at_50%_40%,#F27D2615,transparent_60%)]">
        <div className="max-w-md w-full text-center space-y-12">
          <div className="space-y-4">
             <div className="inline-flex p-4 rounded-3xl bg-white/5 border border-white/10 mb-6 group transition-all duration-700 hover:scale-110">
                <Navigation className="text-orange-500 w-12 h-12" />
             </div>
             <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-none text-white">
                MOTO TRACK <span className="text-orange-500">PRO</span>
             </h1>
             <p className="text-white/40 font-mono text-sm tracking-widest italic max-w-xs mx-auto">
                HIGH-ACCURACY TELEMETRY FOR THE MODERN RIDER
             </p>
          </div>

          <button
            onClick={login}
            className="w-full h-16 bg-white text-black rounded-2xl flex items-center justify-center gap-3 font-black tracking-widest uppercase hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
          >
            <LogIn size={20} />
            Connect via Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-bento-bg text-bento-text font-sans p-safe overflow-hidden select-none flex flex-col md:p-6 pb-20 md:pb-6">
      <header className="flex flex-wrap justify-between items-center mb-4 min-h-[48px] border-b border-white/10 pb-4 gap-y-4 px-4 md:px-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bento-orange rounded-md flex items-center justify-center font-bold text-black italic text-xl">M</div>
          <h1 className="text-xl md:text-2xl font-medium tracking-tight uppercase italic text-white flex items-center flex-wrap">
            MotoTrack <span className="text-bento-orange not-italic text-xs md:text-sm ml-2 font-mono mt-1">Pro v2.0</span>
          </h1>
        </div>
        <div className="flex gap-4 md:gap-6 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${activeRide ? 'bg-red-500 animate-pulse' : 'bg-[#00FF41] animate-pulse'}`}></div>
            <span className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase flex items-center gap-1 mt-0.5 hidden sm:flex">
              {activeRide ? 'RECORDING' : 'STANDBY'}
            </span>
          </div>
          <button 
            onClick={() => setShowHistory(true)}
            className="text-[10px] md:text-xs font-bold tracking-widest text-bento-orange uppercase hover:text-white transition-colors h-11 px-2 flex items-center justify-center"
          >
            History
          </button>
          <button 
            onClick={logout}
            className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase hover:text-white transition-colors h-11 px-2 flex items-center justify-center"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 overflow-hidden pb-4 lg:pb-0 px-4 md:px-0 relative">
        <div className={`
          bg-zinc-900/50 border border-bento-border shadow-2xl overflow-hidden relative
          lg:flex-[2] lg:min-h-0 lg:flex lg:rounded-2xl
          ${showMobileMap ? 'fixed inset-4 z-[9000] flex flex-col rounded-2xl' : 'hidden'}
        `}>
          {showMobileMap && (
            <button 
              onClick={() => setShowMobileMap(false)}
              className="lg:hidden absolute top-4 right-4 z-[9000] bg-black/80 backdrop-blur-md p-2 rounded-full border border-white/20 text-white shadow-xl flex items-center justify-center active:scale-95 transition-all"
            >
              <X size={20} />
            </button>
          )}

          {glowTrigger > 0 && (
            <div 
              key={glowTrigger}
              className="absolute inset-scale-0 rounded-2xl border-2 border-bento-orange/80 shadow-[0_0_60px_10px_rgba(242,125,38,0.3),inset_0_0_60px_rgba(242,125,38,0.3)] animate-ride-glow pointer-events-none z-50 text-bento-orange"
            />
          )}

          <RideMap points={points} isTracking={!!activeRide} className="flex-1" />
          
          <div className="absolute top-4 left-4 z-[1000] bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl text-xs font-mono uppercase text-zinc-400 border border-white/10 hidden md:block">
            {distance > 0 ? (distance > 1000 ? `${(distance/1000).toFixed(2)} KM` : `${distance} M`) : 'WAITING FOR GPS'}
          </div>
        </div>

        <StatsOverlay 
          currentSpeed={currentSpeed}
          maxSpeed={maxSpeed}
          distance={distance}
          duration={duration}
          isRecording={!!activeRide}
          isFinishing={isFinishing}
          overSpeed={overSpeed}
          onToggleRecording={activeRide ? stopRecording : startRecording}
        />
      </div>

      <button
        onClick={() => setShowMobileMap(true)}
        className={`
          md:hidden fixed z-[8000] bottom-28 left-6 w-14 h-14 bg-bento-card border border-white/10
          rounded-2xl shadow-2xl flex items-center justify-center text-white active:scale-90 transition-all
          ${showMobileMap ? "hidden" : "flex"}
        `}
      >
         <MapIcon size={24} className="text-bento-orange" />
      </button>

      {lastFinishedRide && (
        <SummaryScreen 
          ride={lastFinishedRide} 
          onClose={() => setLastFinishedRide(null)} 
        />
      )}

      {showHistory && (
        <HistoryScreen 
          rides={rides.filter(r => !deletedRideIds.has(r.id))} 
          isLoading={isLoadingHistory}
          onClose={() => setShowHistory(false)} 
          onSelectRide={async (r) => {
            // Lazy load points if they aren't present
            if (!r.points || r.points.length === 0) {
              try {
                if (!user) return;
                const pts = await firebaseService.fetchPoints(r.id, user.uid);
                setLastFinishedRide({ ...r, points: pts });
              } catch (e) {
                console.error("Failed to load points:", e);
                setLastFinishedRide({ ...r, points: [] });
              }
            } else {
              setLastFinishedRide(r);
            }
          }}
          onDeleteRide={async (rideId) => {
            if (!user) return;
            console.log(`Initiating deletion for ${rideId}`);
            try {
              // 1. Add to local blacklist to hide from UI instantly
              setDeletedRideIds(prev => new Set(Array.from(prev).concat(rideId)));
              
              // 2. Delete from Cloud
              await firebaseService.deleteRide(rideId, user.uid);
              console.log(`Cloud deletion successful for ${rideId}`);
              
              // 3. Final state cleanup once cloud action completes
              setRides(prev => prev.filter(r => r.id !== rideId));
              
              // 4. Show success pulse/notification
              setDeleteSuccessId(rideId);
              setTimeout(() => setDeleteSuccessId(null), 3000);
            } catch (e) {
              console.error("Failed to delete ride:", e);
              // Rollback local hidden state if delete failed
              setDeletedRideIds(prev => {
                const next = new Set(prev);
                next.delete(rideId);
                return next;
              });
              
              const errMsg = e instanceof Error ? e.message : "Unknown error";
              alert(`Deletion Failed: ${errMsg}\n\nPlease verify your connection and try again.`);
            }
          }}
          onShowMonthly={() => {
            setShowHistory(false);
            setShowMonthlyStats(true);
          }}
        />
      )}

      {showMonthlyStats && (
        <MonthlyStatsScreen
          rides={rides}
          onClose={() => {
             setShowMonthlyStats(false);
             setShowHistory(true);
          }}
        />
      )}

      {/* Success Notification - Minimal & Clean */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: deleteSuccessId ? 1 : 0, y: deleteSuccessId ? 0 : 50 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10001] pointer-events-none"
      >
        <div className="bg-green-500 text-white px-6 py-3 rounded-2xl font-black tracking-widest uppercase text-xs shadow-2xl flex items-center gap-3 italic">
          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
          Ride Log Purged Successfully
        </div>
      </motion.div>
    </div>
  );
}
