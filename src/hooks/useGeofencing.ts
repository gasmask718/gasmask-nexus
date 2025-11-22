import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Store {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface GeofencingOptions {
  stores: Store[];
  userId: string;
  onCheckIn?: (storeId: string, storeName: string) => void;
  radius?: number; // in meters
}

export const useGeofencing = ({ 
  stores, 
  userId, 
  onCheckIn,
  radius = 50 
}: GeofencingOptions) => {
  const watchIdRef = useRef<number | null>(null);
  const checkedInStoresRef = useRef<Set<string>>(new Set());

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const checkGeofences = async (position: GeolocationPosition) => {
    const { latitude, longitude } = position.coords;

    for (const store of stores) {
      if (!store.lat || !store.lng) continue;

      const distance = calculateDistance(
        latitude,
        longitude,
        store.lat,
        store.lng
      );

      // Check if within geofence radius
      if (distance <= radius && !checkedInStoresRef.current.has(store.id)) {
        checkedInStoresRef.current.add(store.id);

        // Log location event
        try {
          const { error } = await supabase
            .from('location_events')
            .insert({
              user_id: userId,
              store_id: store.id,
              event_type: 'auto_check_in',
              lat: latitude,
              lng: longitude,
              distance_from_store_meters: distance,
            });

          if (error) throw error;

          toast.success(`Auto-checked in at ${store.name}`);
          onCheckIn?.(store.id, store.name);
        } catch (error) {
          console.error('Auto check-in error:', error);
        }
      } else if (distance > radius * 2) {
        // Remove from checked-in set when far away
        checkedInStoresRef.current.delete(store.id);
      }
    }
  };

  useEffect(() => {
    if (!navigator.geolocation || stores.length === 0) return;

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      checkGeofences,
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000, // 10 seconds
        timeout: 5000,
      }
    );

    // Cleanup
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [stores, userId, radius]);

  return {
    isActive: watchIdRef.current !== null,
  };
};
