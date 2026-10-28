export interface Position { lat: number; lng: number }
export interface LocatedStop { id: string; status: string; planned_order: number; store_lat?: number | null; store_lng?: number | null; store_address?: string }
export const isRemaining = (s: LocatedStop) => !['complete', 'completed', 'visited', 'skipped', 'closed', 'cancelled', 'canceled'].includes(s.status);
export function coordinates(s: LocatedStop): Position | null {
  const lat = s.store_lat; const lng = s.store_lng;
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}
export function milesBetween(a: Position, b: Position) {
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function nearbyStops<T extends LocatedStop>(stops: T[], origin: Position | null, radius: number | null) {
  return stops.filter(isRemaining).map(s => { const p = coordinates(s); return { ...s, distance: origin && p ? milesBetween(origin, p) : null }; })
    .filter(s => radius === null || (s.distance !== null && s.distance <= radius))
    .sort((a, b) => origin ? (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.planned_order - b.planned_order : a.planned_order - b.planned_order);
}
export function nearestNext<T extends LocatedStop>(stops: T[], origin: Position, limit = 9): T[] {
  const remaining = stops.filter(s => isRemaining(s) && coordinates(s)); const result: T[] = []; let cursor = origin;
  while (remaining.length && result.length < Math.min(limit, 9)) {
    remaining.sort((a, b) => milesBetween(cursor, coordinates(a) as Position) - milesBetween(cursor, coordinates(b) as Position));
    const next = remaining.shift(); if (!next) break; result.push(next); cursor = coordinates(next) as Position;
  }
  return result;
}
export function googleDirections(stops: LocatedStop[], origin: Position | null, mode: 'driving' | 'walking' = 'driving') {
  const destinations = stops.slice(0, 9).map(s => { const p = coordinates(s); return p ? `${p.lat},${p.lng}` : s.store_address; }).filter((s): s is string => !!s);
  if (!destinations.length) return null;
  const params = new URLSearchParams({ api: '1', travelmode: mode, destination: destinations[destinations.length - 1] });
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
  if (destinations.length > 1) params.set('waypoints', destinations.slice(0, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}
// Approximate travel time from straight-line distance, not live road/traffic routing.
export const travelEstimate = (miles: number) => ({ walking: Math.max(1, Math.ceil(miles / 3 * 60)), driving: Math.max(1, Math.ceil(miles / 15 * 60)) });
