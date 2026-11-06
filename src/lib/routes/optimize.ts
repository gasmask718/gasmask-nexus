// Day-route optimizer: nearest-neighbor seed + 2-opt, honoring pinned first/last stops
// and time windows ("boss only 10am-12pm", "after 6pm"). Straight-line miles; drive time
// uses an average city speed, so totals are estimates, not live traffic.
import { milesBetween, type Position } from './nearMe';

export interface PlanStop {
  id: string;
  lat: number | null;
  lng: number | null;
  area?: string | null;
  address?: string | null;
  pinned?: 'first' | 'last' | null;
  /** minutes after midnight */
  windowStart?: number | null;
  windowEnd?: number | null;
}
export interface PlanOptions {
  start: Position | null;
  returnToStart?: boolean;
  serviceMinutes?: number;
  mph?: number;
  /** minutes after midnight the route starts */
  startMinute?: number;
}
export interface PlanResult<T> {
  order: T[];
  noGps: T[];
  miles: number;
  minutes: number;
  late: string[];
  arrivals: Record<string, number>;
}

const pos = (s: PlanStop): Position | null =>
  s.lat != null && s.lng != null && Number.isFinite(s.lat) && Number.isFinite(s.lng) && !(s.lat === 0 && s.lng === 0) ? { lat: s.lat, lng: s.lng } : null;

export const parseClock = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const clock = (min: number) => {
  const h = Math.floor(min / 60) % 24; const m = Math.round(min % 60);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
};

/** Walk the order and compute miles, minutes, arrival times and late stops. */
export function evaluate<T extends PlanStop>(order: T[], o: PlanOptions) {
  const mph = o.mph ?? 15; const service = o.serviceMinutes ?? 10;
  let t = o.startMinute ?? 9 * 60; let miles = 0; let cur = o.start; let penalty = 0;
  const late: string[] = []; const arrivals: Record<string, number> = {};
  for (const s of order) {
    const p = pos(s);
    if (cur && p) { const d = milesBetween(cur, p); miles += d; t += (d / mph) * 60; }
    if (s.windowStart != null && t < s.windowStart) t = s.windowStart; // wait until it opens
    arrivals[s.id] = t;
    if (s.windowEnd != null && t > s.windowEnd) { late.push(s.id); penalty += 1000 + (t - s.windowEnd) * 10; }
    t += service;
    if (p) cur = p;
  }
  if (o.returnToStart && o.start && cur) { const d = milesBetween(cur, o.start); miles += d; t += (d / mph) * 60; }
  return { miles, minutes: Math.round(t - (o.startMinute ?? 9 * 60)), late, arrivals, cost: miles + penalty };
}

export function optimizeRoute<T extends PlanStop>(stops: T[], o: PlanOptions): PlanResult<T> {
  const located = stops.filter((s) => pos(s));
  const noGps = stops.filter((s) => !pos(s)).sort((a, b) => `${a.area ?? ''} ${a.address ?? ''}`.localeCompare(`${b.area ?? ''} ${b.address ?? ''}`));
  const first = located.filter((s) => s.pinned === 'first');
  const last = located.filter((s) => s.pinned === 'last');
  const free = located.filter((s) => s.pinned !== 'first' && s.pinned !== 'last');

  // Nearest neighbor from the start (or from the last pinned-first stop).
  const seed: T[] = []; const pool = [...free];
  let cur: Position | null = first.length ? pos(first[first.length - 1]) : o.start ?? (pool[0] ? pos(pool[0]) : null);
  while (pool.length) {
    let bi = 0; let bd = Infinity;
    for (let i = 0; i < pool.length; i++) { const d = cur ? milesBetween(cur, pos(pool[i]) as Position) : 0; if (d < bd) { bd = d; bi = i; } }
    const [n] = pool.splice(bi, 1); seed.push(n); cur = pos(n);
  }

  // 2-opt on the free middle section; cost includes time-window penalties.
  const full = (mid: T[]) => [...first, ...mid, ...last];
  let best = seed; let bestCost = evaluate(full(best), o).cost;
  const n = best.length; let improved = n > 2; let passes = 0;
  while (improved && passes < 50) {
    improved = false; passes++;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const c = evaluate(full(cand), o).cost;
        if (c + 1e-9 < bestCost) { best = cand; bestCost = c; improved = true; }
      }
    }
  }
  const order = full(best);
  const ev = evaluate([...order, ...noGps], o);
  return { order: [...order, ...noGps], noGps, miles: ev.miles, minutes: ev.minutes, late: ev.late, arrivals: ev.arrivals };
}
