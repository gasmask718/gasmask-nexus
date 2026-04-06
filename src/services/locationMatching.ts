import { supabase } from '@/integrations/supabase/client';
import { GeocodingService } from './geocoding';

export interface MatchedProvider {
  provider_id: string;
  provider_name: string;
  provider_type: string;
  city: string;
  distance_miles: number;
  service_radius: number;
}

export interface MatchedVehicle {
  vehicle_id: string;
  vehicle_name: string;
  category: string;
  city: string;
  distance_miles: number;
  available_for_decor: boolean;
  available_for_chauffeur: boolean;
  available_for_nightlife: boolean;
}

/**
 * Resolve a location string to lat/lng using Mapbox geocoding
 */
export async function resolveLocation(
  location?: string,
  city?: string,
  zip?: string
): Promise<{ lat: number; lng: number } | null> {
  const result = await GeocodingService.geocodeAddress(
    undefined,
    city || undefined,
    undefined,
    zip || undefined,
    'USA'
  );

  if ('error' in result) {
    // Try with full location string
    if (location) {
      const fallback = await GeocodingService.geocodeAddress(location);
      if ('error' in fallback) return null;
      return { lat: fallback.lat, lng: fallback.lng };
    }
    return null;
  }

  return { lat: result.lat, lng: result.lng };
}

/**
 * Find providers within service radius of a location
 */
export async function matchProviders(
  lat: number,
  lng: number,
  category?: string
): Promise<MatchedProvider[]> {
  const { data, error } = await supabase.rpc('match_providers_by_location', {
    p_lat: lat,
    p_lng: lng,
    p_category: category || null,
  });

  if (error) {
    console.error('Provider matching error:', error);
    return [];
  }

  return (data || []) as MatchedProvider[];
}

/**
 * Find vehicles near a location
 */
export async function matchVehicles(
  lat: number,
  lng: number,
  maxDistance: number = 50
): Promise<MatchedVehicle[]> {
  const { data, error } = await supabase.rpc('match_vehicles_by_location', {
    p_lat: lat,
    p_lng: lng,
    p_max_distance: maxDistance,
  });

  if (error) {
    console.error('Vehicle matching error:', error);
    return [];
  }

  return (data || []) as MatchedVehicle[];
}
