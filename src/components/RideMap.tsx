import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationPoint } from '../types';

interface RideMapProps {
  points: LocationPoint[];
  isTracking: boolean;
  className?: string;
  zoom?: number;
}

// Logic to center the map when tracking is active or fit bounds when session finished
const ChangeView = ({ points, isTracking, fitBounds }: { points: LocationPoint[], isTracking: boolean, fitBounds?: boolean }) => {
  const map = useMap();
  useEffect(() => {
    if (isTracking && points.length > 0) {
      const last = points[points.length - 1];
      map.setView([last.latitude, last.longitude], map.getZoom(), { animate: true, duration: 1 });
    } else if (fitBounds && points.length > 1) {
      const bounds = points.map(p => [p.latitude, p.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [20, 20], animate: true, duration: 1.5 });
    }
  }, [points, isTracking, map, fitBounds]);
  return null;
};

// Logic to animate drawing
const AnimatedPolyline = ({ points }: { points: LocationPoint[] }) => {
  const positions = points.map(p => [p.latitude, p.longitude] as [number, number]);
  
  if (positions.length < 2) return null;

  return (
    <Polyline 
      positions={positions}
      pathOptions={{ 
        color: '#FF8C00', 
        weight: 5, 
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        className: 'animate-draw-flow transition-all'
      }} 
    />
  );
};

export const RideMap = ({ points, isTracking, className = '', zoom = 14, fitBounds = false }: RideMapProps & { fitBounds?: boolean }) => {
  const defaultCenter: [number, number] = points.length > 0 
    ? [points[points.length - 1].latitude, points[points.length - 1].longitude] 
    : [37.7749, -122.4194]; // Default to SF if no points

  // Decimate points for performance if super long ride
  const renderedPoints = useMemo(() => {
    if (points.length < 500) return points;
    const skip = Math.floor(points.length / 500);
    return points.filter((_, i) => i % skip === 0 || i === points.length - 1);
  }, [points]);

  return (
    <div className={`w-full h-full bg-zinc-900 ${className}`}>
      <MapContainer 
        center={defaultCenter} 
        zoom={zoom} 
        className="w-full h-full z-0 font-sans"
        zoomControl={false}
        preferCanvas={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <AnimatedPolyline points={renderedPoints} />
        <ChangeView points={points} isTracking={isTracking} fitBounds={fitBounds} />
      </MapContainer>
    </div>
  );
};
