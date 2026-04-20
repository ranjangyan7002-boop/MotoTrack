import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc, 
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Ride, LocationPoint } from '../types';

export const firebaseService = {
  /**
   * Delete a ride and its associated points (sub-collection)
   */
  async deleteRide(rideId: string, userId: string) {
    console.log(`Starting deletion for ride ${rideId}`);
    const rideRef = doc(db, 'rides', rideId);
    
    try {
      // 1. Fetch points to delete them (Firestore does not delete sub-collections automatically)
      const pointsRef = collection(db, 'rides', rideId, 'points');
      // We filter by userId to ensure we only try to delete what we own (required by rules)
      const q = query(pointsRef, where('userId', '==', userId));
      const pointsSnapshot = await getDocs(q);
      
      console.log(`Matched ${pointsSnapshot.size} points for deletion`);

      // 2. Use batches to delete points efficiently (limit 500 per batch)
      if (pointsSnapshot.size > 0) {
        const batches: Promise<void>[] = [];
        let currentBatch = writeBatch(db);
        let count = 0;

        pointsSnapshot.forEach((pointDoc) => {
          currentBatch.delete(pointDoc.ref);
          count++;
          if (count === 450) { // Slightly below 500 safety margin
            batches.push(currentBatch.commit());
            currentBatch = writeBatch(db);
            count = 0;
          }
        });
        
        if (count > 0) batches.push(currentBatch.commit());
        await Promise.all(batches);
        console.log("Telemetry points purged");
      }
    } catch (err) {
      console.error("Error purging sub-collection points:", err);
      // We continue to delete the main ride record anyway
    }
    
    // 3. Delete the main ride document
    await deleteDoc(rideRef);
    console.log("Main ride document deleted");
  },

  /**
   * Start a new ride record
   */
  async startRide(userId: string, startTime: number, rideId: string) {
    await setDoc(doc(db, 'rides', rideId), {
      userId,
      startTime,
      status: 'recording',
      distance: 0,
      maxSpeed: 0,
      avgSpeed: 0,
    });
    return rideId;
  },

  /**
   * Update ride statistics
   */
  async updateRideStats(rideId: string, stats: Partial<Ride>) {
    const rideRef = doc(db, 'rides', rideId);
    // Sanitize stats: only keep core metadata
    const cleanStats: any = {};
    if (stats.distance !== undefined) cleanStats.distance = stats.distance;
    if (stats.maxSpeed !== undefined) cleanStats.maxSpeed = stats.maxSpeed;
    if (stats.avgSpeed !== undefined) cleanStats.avgSpeed = stats.avgSpeed;
    if (stats.status !== undefined) cleanStats.status = stats.status;
    
    await updateDoc(rideRef, cleanStats);
  },

  /**
   * Finish a ride and save final stats
   */
  async finishRide(rideId: string, stats: Partial<Ride>) {
    const rideRef = doc(db, 'rides', rideId);
    // Sanitize stats: remove points array and synced flags
    const { points, isSynced, syncError, id, ...cleanStats } = stats as any;
    
    await updateDoc(rideRef, {
      ...cleanStats,
      status: 'completed',
    });
  },

  /**
   * Save a single point to the points subcollection
   */
  async savePoint(rideId: string, userId: string, point: LocationPoint) {
    const pointsRef = collection(db, 'rides', rideId, 'points');
    await addDoc(pointsRef, {
      ...point,
      rideId,
      userId, // Add userId for easier/faster security rules
    });
  },

  /**
   * Fetch ride history for a user
   */
  async fetchRides(userId: string): Promise<Ride[]> {
    const q = query(
      collection(db, 'rides'), 
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      points: []
    } as unknown as Ride))
    .sort((a, b) => b.startTime - a.startTime);
  },

  /**
   * Fetch points for a specific ride
   */
  async fetchPoints(rideId: string, userId: string): Promise<LocationPoint[]> {
    const q = query(
      collection(db, 'rides', rideId, 'points'),
      where('userId', '==', userId),
      orderBy('timestamp', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as LocationPoint);
  },

  /**
   * Real-time listener for user rides
   */
  subscribeToRides(userId: string, callback: (rides: Ride[]) => void) {
    const q = query(
      collection(db, 'rides'), 
      where('userId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const rides = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        points: []
      } as unknown as Ride))
      .sort((a, b) => b.startTime - a.startTime);
      callback(rides);
    }, (err) => {
      console.error("Firestore subscription error:", err);
    });
  }
};
