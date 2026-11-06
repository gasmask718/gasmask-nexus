import type { Position } from './nearMe';

export interface NavStop { lat: number | null; lng: number | null; address?: string | null }
const target = (s: NavStop) => (s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.address || '');

export const googleNav = (s: NavStop) => `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(target(s))}`;
export const wazeNav = (s: NavStop) => s.lat != null && s.lng != null
  ? `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`
  : `https://waze.com/ul?q=${encodeURIComponent(s.address || '')}&navigate=yes`;
export const appleNav = (s: NavStop) => `https://maps.apple.com/?daddr=${encodeURIComponent(target(s))}&dirflg=d`;

/** Whole route as Google Maps links, each with at most 10 points (origin + up to 8 waypoints + destination). */
export function googleRouteChunks(stops: NavStop[], origin: Position | null): string[] {
  const pts = stops.map(target).filter(Boolean);
  const urls: string[] = [];
  let from: string | null = origin ? `${origin.lat},${origin.lng}` : null;
  let i = 0;
  while (i < pts.length) {
    const take = from ? 9 : 10; // origin counts as one of the 10 points
    const chunk = pts.slice(i, i + take);
    const params = new URLSearchParams({ api: '1', travelmode: 'driving', destination: chunk[chunk.length - 1] });
    if (from) params.set('origin', from);
    if (chunk.length > 1) params.set('waypoints', chunk.slice(0, -1).join('|'));
    urls.push(`https://www.google.com/maps/dir/?${params}`);
    from = chunk[chunk.length - 1];
    i += take;
  }
  return urls;
}
