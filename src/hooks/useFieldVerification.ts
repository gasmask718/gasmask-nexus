import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrewDropRow {
  id: string;
  crew_id: string;
  drop_type: 'sticker' | 'tube_drop' | 'store_visit' | string;
  store_id: string | null;
  store_name: string | null;
  photo_path: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  notes: string | null;
  zone_id: string | null;
  status: 'pending' | 'verified' | 'rejected' | string;
  verified_by: string | null;
  verified_at: string | null;
  flag_reason: string | null;
  earnings: number | null;
  server_timestamp: string | null;
  created_at: string | null;
}

export interface CrewProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  zone_id: string | null;
  rate_per_drop: number | null;
  status: string | null;
}

export interface CrewZoneRow {
  id: string;
  name: string | null;
  city: string | null;
  state: string | null;
  target_drops: number | null;
  is_active: boolean | null;
}

export const DROP_TYPE_LABEL: Record<string, string> = {
  sticker: 'Sticker',
  tube_drop: 'Tube drop',
  store_visit: 'Store visit',
};

/** Marker/badge colors per drop type (hex — used by mapbox markers too). */
export const DROP_TYPE_COLOR: Record<string, string> = {
  sticker: '#f43f5e',
  tube_drop: '#38bdf8',
  store_visit: '#22c55e',
};

export function useCrewDrops(limit = 2000) {
  return useQuery({
    queryKey: ['fv-crew-drops', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew_drops')
        .select(
          'id, crew_id, drop_type, store_id, store_name, photo_path, latitude, longitude, accuracy_m, notes, zone_id, status, verified_by, verified_at, flag_reason, earnings, server_timestamp, created_at',
        )
        .order('server_timestamp', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as CrewDropRow[];
    },
  });
}

export function useCrewProfiles() {
  return useQuery({
    queryKey: ['fv-crew-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew_profiles')
        .select('id, user_id, full_name, phone, zone_id, rate_per_drop, status')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CrewProfileRow[];
    },
  });
}

export function useCrewZones() {
  return useQuery({
    queryKey: ['fv-crew-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew_zones')
        .select('id, name, city, state, target_drops, is_active')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CrewZoneRow[];
    },
  });
}

/** Map of crew auth uid -> display name, built from crew_profiles. */
export function crewNameMap(profiles: CrewProfileRow[] | undefined) {
  const m = new Map<string, string>();
  (profiles ?? []).forEach((p) => m.set(p.user_id, p.full_name || 'Unnamed crew'));
  return m;
}

/** Metres between two lat/lng points (haversine). */
export function metersBetween(
  aLat: number, aLng: number, bLat: number, bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const DUP_WINDOW_MS = 5 * 60 * 1000;
const DUP_RADIUS_M = 15;

/**
 * Set of drop ids that look like a possible duplicate: same crew, within a few
 * minutes and ~15m of another drop. Computed from live rows, never stored.
 */
export function computeDuplicateIds(drops: CrewDropRow[]): Set<string> {
  const flagged = new Set<string>();
  const byCrew = new Map<string, CrewDropRow[]>();
  for (const d of drops) {
    if (d.latitude == null || d.longitude == null) continue;
    const list = byCrew.get(d.crew_id) ?? [];
    list.push(d);
    byCrew.set(d.crew_id, list);
  }
  for (const list of byCrew.values()) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.server_timestamp ?? 0).getTime() - new Date(b.server_timestamp ?? 0).getTime(),
    );
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const ta = new Date(sorted[i].server_timestamp ?? 0).getTime();
        const tb = new Date(sorted[j].server_timestamp ?? 0).getTime();
        if (tb - ta > DUP_WINDOW_MS) break;
        const dist = metersBetween(
          sorted[i].latitude!, sorted[i].longitude!,
          sorted[j].latitude!, sorted[j].longitude!,
        );
        if (dist <= DUP_RADIUS_M) {
          flagged.add(sorted[i].id);
          flagged.add(sorted[j].id);
        }
      }
    }
  }
  return flagged;
}

const DRIFT_SAMPLE = 20;
const DRIFT_RADIUS_M = 50;

/**
 * Crew ids whose last ~20 drops all sit inside an unusually small radius —
 * a hint they may not be moving between drops. Advisory only.
 */
export function computeGpsDriftCrewIds(drops: CrewDropRow[]): Set<string> {
  const drift = new Set<string>();
  const byCrew = new Map<string, CrewDropRow[]>();
  for (const d of drops) {
    if (d.latitude == null || d.longitude == null) continue;
    const list = byCrew.get(d.crew_id) ?? [];
    list.push(d);
    byCrew.set(d.crew_id, list);
  }
  for (const [crewId, list] of byCrew) {
    const recent = [...list]
      .sort((a, b) => new Date(b.server_timestamp ?? 0).getTime() - new Date(a.server_timestamp ?? 0).getTime())
      .slice(0, DRIFT_SAMPLE);
    if (recent.length < DRIFT_SAMPLE) continue;
    const lat = recent.reduce((s, r) => s + r.latitude!, 0) / recent.length;
    const lng = recent.reduce((s, r) => s + r.longitude!, 0) / recent.length;
    const maxDist = Math.max(...recent.map((r) => metersBetween(lat, lng, r.latitude!, r.longitude!)));
    if (maxDist <= DRIFT_RADIUS_M) drift.add(crewId);
  }
  return drift;
}
