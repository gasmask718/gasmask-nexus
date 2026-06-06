/**
 * useNearestAvailableField — additive helper for assignment pickers.
 *
 * Returns active field workers (drivers, bikers, ambassadors with active
 * field_sessions) sorted by live distance from a target point, filtered
 * by the roles eligible for the trigger type.
 *
 * Trigger → eligible roles (additive — never narrows the existing picker):
 *   delivery      → driver, biker
 *   pickup        → driver, biker
 *   store_visit   → driver, biker, ambassador
 *   capture       → driver, biker, ambassador
 *   default       → driver, biker
 *
 * This hook reuses useLiveWorkers so ambassadors only appear when they
 * have an active Field Session (manual or run-triggered) — matching the
 * "tracking only when active" rule.
 */
import { useMemo } from 'react';
import { useLiveWorkers, type WorkerLocation } from '@/hooks/useLiveMapData';

export type TriggerKind = 'delivery' | 'pickup' | 'store_visit' | 'capture' | 'other';

const ELIGIBLE_ROLES: Record<TriggerKind, Array<WorkerLocation['role']>> = {
  delivery:    ['driver', 'biker'],
  pickup:      ['driver', 'biker'],
  store_visit: ['driver', 'biker', 'ambassador'],
  capture:     ['driver', 'biker', 'ambassador'],
  other:       ['driver', 'biker'],
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function useNearestAvailableField(
  target: { lat: number; lng: number } | null,
  trigger: TriggerKind = 'other',
) {
  const { data: workers = [], isLoading } = useLiveWorkers();

  const sorted = useMemo(() => {
    if (!target || !workers.length) return [] as Array<WorkerLocation & { distance_km: number }>;
    const eligible = ELIGIBLE_ROLES[trigger] || ELIGIBLE_ROLES.other;
    return workers
      .filter((w) => eligible.includes(w.role) && w.status !== 'offline' && w.lat && w.lng)
      .map((w) => ({ ...w, distance_km: haversineKm(target, { lat: w.lat, lng: w.lng }) }))
      .sort((a, b) => a.distance_km - b.distance_km);
  }, [target, workers, trigger]);

  return { workers: sorted, isLoading };
}
