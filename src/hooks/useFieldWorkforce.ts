// ═══════════════════════════════════════════════════════════════════════════════
// FIELD WORKFORCE — management read model for Route Command Center.
//
// Reuses existing identities and tables only:
//   ambassadors / drivers / bikers          → who exists
//   ambassador_assignments + coverage       → territory & workload for ambassadors
//   routes + route_stops                    → current route, progress
//   route_checkins                          → last check-in
// No new worker tables. Nothing is written here.
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type WorkforceRole = 'ambassador' | 'driver' | 'biker';

export interface WorkerRouteSummary {
  id: string;
  name: string | null;
  date: string | null;
  status: string | null;
  territory: string | null;
  totalStops: number;
  completedStops: number;
  remainingStops: number;
  lastActivityAt: string | null;
}

export interface WorkerRow {
  id: string;
  userId: string | null;
  name: string;
  role: WorkforceRole;
  active: boolean;
  territory: string | null;
  phone: string | null;
  email: string | null;
  /** Active store assignments (ambassadors) — real rows only. */
  assignedStores: number | null;
  /** Route the person is on right now (active / in_progress / scheduled / planned today). */
  currentRoute: WorkerRouteSummary | null;
  /** Every non-finished route assigned to them. */
  openRoutes: number;
  assignedStopCount: number;
  completedStopCount: number;
  remainingStopCount: number;
  lastCheckInAt: string | null;
  lastActivityAt: string | null;
  loginState: 'active_login' | 'no_login';
}

export interface LiveRouteRow {
  id: string;
  name: string | null;
  date: string | null;
  status: string | null;
  type: string | null;
  territory: string | null;
  assignedTo: string | null;
  workerName: string | null;
  workerRole: WorkforceRole | 'unassigned';
  totalStops: number;
  completedStops: number;
  remainingStops: number;
  lastActivityAt: string | null;
  lastCheckInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const OPEN_ROUTE_STATUSES = ['planned', 'pending', 'scheduled', 'active', 'in_progress', 'paused'];
const CURRENT_ROUTE_STATUSES = ['active', 'in_progress', 'scheduled', 'planned', 'pending'];
const DONE_STOP_STATUSES = ['completed', 'done', 'skipped'];

function norm(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length ? s : null;
}

export function useFieldWorkforce() {
  return useQuery({
    queryKey: ['field-workforce'],
    staleTime: 30_000,
    queryFn: async () => {
      const [ambRes, drvRes, bkrRes, routeRes, assignRes, coverRes] = await Promise.all([
        (supabase as any)
          .from('ambassadors')
          .select('id, user_id, name, is_active, city, state, neighborhood, phone_primary, email, is_simulation, deleted_at')
          .is('deleted_at', null)
          .limit(1000),
        (supabase as any)
          .from('drivers')
          .select('id, user_id, full_name, status, city, state, neighborhood, home_base, phone, email, is_simulation')
          .limit(1000),
        (supabase as any)
          .from('bikers')
          .select('id, user_id, full_name, status, city, state, neighborhood, territory, phone, email, is_simulation')
          .limit(1000),
        (supabase as any)
          .from('routes')
          .select('id, name, date, type, status, territory, assigned_to, started_at, completed_at, created_at')
          .order('date', { ascending: false })
          .limit(500),
        (supabase as any)
          .from('ambassador_assignments')
          .select('ambassador_id, store_id, active')
          .eq('active', true)
          .limit(5000),
        (supabase as any)
          .from('ambassador_territory_coverage')
          .select('ambassador_id, region_type, region_value, is_primary')
          .limit(5000),
      ]);

      const routes = (routeRes.data || []) as any[];
      const routeIds = routes.map((r) => r.id);

      const [stopRes, checkinRes, profileRes] = await Promise.all([
        routeIds.length
          ? (supabase as any)
              .from('route_stops')
              .select('id, route_id, status, actual_arrival')
              .in('route_id', routeIds)
              .limit(10000)
          : Promise.resolve({ data: [] }),
        routeIds.length
          ? (supabase as any)
              .from('route_checkins')
              .select('route_id, driver_id, checkin_time')
              .in('route_id', routeIds)
              .order('checkin_time', { ascending: false })
              .limit(2000)
          : Promise.resolve({ data: [] }),
        (supabase as any).from('profiles').select('id, name, email').limit(1000),
      ]);

      const profileMap = new Map<string, string>(
        ((profileRes.data || []) as any[]).map((p) => [p.id, p.name || p.email || 'Unknown user']),
      );

      // ── Stops per route
      const stopAgg = new Map<string, { total: number; completed: number; last: string | null }>();
      for (const s of (stopRes.data || []) as any[]) {
        const a = stopAgg.get(s.route_id) || { total: 0, completed: 0, last: null };
        a.total += 1;
        if (DONE_STOP_STATUSES.includes(String(s.status || '').toLowerCase()) || s.actual_arrival) a.completed += 1;
        if (s.actual_arrival && (!a.last || s.actual_arrival > a.last)) a.last = s.actual_arrival;
        stopAgg.set(s.route_id, a);
      }

      // ── Latest check-in per route (already ordered desc)
      const checkinByRoute = new Map<string, string>();
      for (const c of (checkinRes.data || []) as any[]) {
        if (!checkinByRoute.has(c.route_id) && c.checkin_time) checkinByRoute.set(c.route_id, c.checkin_time);
      }

      // ── Assignments / coverage per ambassador
      const assignCount = new Map<string, number>();
      for (const a of (assignRes.data || []) as any[]) {
        assignCount.set(a.ambassador_id, (assignCount.get(a.ambassador_id) || 0) + 1);
      }
      const coverage = new Map<string, string[]>();
      for (const c of (coverRes.data || []) as any[]) {
        const v = norm(c.region_value);
        if (!v) continue;
        const list = coverage.get(c.ambassador_id) || [];
        if (!list.includes(v)) list.push(v);
        coverage.set(c.ambassador_id, list);
      }

      // ── Build worker rows
      const workers: WorkerRow[] = [];

      for (const a of (ambRes.data || []) as any[]) {
        if (a.is_simulation) continue;
        const cov = coverage.get(a.id) || [];
        const territory =
          cov.join(', ') || [norm(a.neighborhood), norm(a.city), norm(a.state)].filter(Boolean).join(', ') || null;
        workers.push({
          id: a.id,
          userId: a.user_id ?? null,
          name: a.name || 'Unnamed ambassador',
          role: 'ambassador',
          active: a.is_active !== false,
          territory,
          phone: norm(a.phone_primary),
          email: norm(a.email),
          assignedStores: assignCount.get(a.id) || 0,
          currentRoute: null,
          openRoutes: 0,
          assignedStopCount: 0,
          completedStopCount: 0,
          remainingStopCount: 0,
          lastCheckInAt: null,
          lastActivityAt: null,
          loginState: a.user_id ? 'active_login' : 'no_login',
        });
      }

      for (const d of (drvRes.data || []) as any[]) {
        if (d.is_simulation) continue;
        workers.push({
          id: d.id,
          userId: d.user_id ?? null,
          name: d.full_name || 'Unnamed driver',
          role: 'driver',
          active: String(d.status || 'active').toLowerCase() === 'active',
          territory: [norm(d.home_base), norm(d.neighborhood), norm(d.city), norm(d.state)].filter(Boolean).join(', ') || null,
          phone: norm(d.phone),
          email: norm(d.email),
          assignedStores: null,
          currentRoute: null,
          openRoutes: 0,
          assignedStopCount: 0,
          completedStopCount: 0,
          remainingStopCount: 0,
          lastCheckInAt: null,
          lastActivityAt: null,
          loginState: d.user_id ? 'active_login' : 'no_login',
        });
      }

      for (const b of (bkrRes.data || []) as any[]) {
        if (b.is_simulation) continue;
        workers.push({
          id: b.id,
          userId: b.user_id ?? null,
          name: b.full_name || 'Unnamed biker',
          role: 'biker',
          active: String(b.status || 'active').toLowerCase() === 'active',
          territory: [norm(b.territory), norm(b.neighborhood), norm(b.city), norm(b.state)].filter(Boolean).join(', ') || null,
          phone: norm(b.phone),
          email: norm(b.email),
          assignedStores: null,
          currentRoute: null,
          openRoutes: 0,
          assignedStopCount: 0,
          completedStopCount: 0,
          remainingStopCount: 0,
          lastCheckInAt: null,
          lastActivityAt: null,
          loginState: b.user_id ? 'active_login' : 'no_login',
        });
      }

      const byUserId = new Map<string, WorkerRow[]>();
      for (const w of workers) {
        if (!w.userId) continue;
        const list = byUserId.get(w.userId) || [];
        list.push(w);
        byUserId.set(w.userId, list);
      }

      // ── Live routes + fold progress back into the worker rows
      const liveRoutes: LiveRouteRow[] = routes.map((r) => {
        const agg = stopAgg.get(r.id) || { total: 0, completed: 0, last: null };
        const owners = r.assigned_to ? byUserId.get(r.assigned_to) || [] : [];
        const owner = owners[0];
        const checkin = checkinByRoute.get(r.id) ?? null;
        const row: LiveRouteRow = {
          id: r.id,
          name: norm(r.name),
          date: r.date ?? null,
          status: norm(r.status),
          type: norm(r.type),
          territory: norm(r.territory),
          assignedTo: r.assigned_to ?? null,
          workerName: owner?.name ?? (r.assigned_to ? profileMap.get(r.assigned_to) ?? 'Unknown user' : null),
          workerRole: owner?.role ?? (r.assigned_to ? (norm(r.type) === 'biker' ? 'biker' : 'driver') : 'unassigned'),
          totalStops: agg.total,
          completedStops: agg.completed,
          remainingStops: Math.max(agg.total - agg.completed, 0),
          lastActivityAt: agg.last ?? r.completed_at ?? r.started_at ?? null,
          lastCheckInAt: checkin,
          startedAt: r.started_at ?? null,
          completedAt: r.completed_at ?? null,
        };

        const status = String(r.status || '').toLowerCase();
        for (const w of owners) {
          if (OPEN_ROUTE_STATUSES.includes(status)) {
            w.openRoutes += 1;
            w.assignedStopCount += agg.total;
            w.completedStopCount += agg.completed;
            w.remainingStopCount += Math.max(agg.total - agg.completed, 0);
            const isCurrent = CURRENT_ROUTE_STATUSES.includes(status);
            if (isCurrent && (!w.currentRoute || (r.date ?? '') > (w.currentRoute.date ?? ''))) {
              w.currentRoute = {
                id: r.id,
                name: norm(r.name),
                date: r.date ?? null,
                status: norm(r.status),
                territory: norm(r.territory),
                totalStops: agg.total,
                completedStops: agg.completed,
                remainingStops: Math.max(agg.total - agg.completed, 0),
                lastActivityAt: agg.last ?? r.started_at ?? null,
              };
            }
          }
          if (checkin && (!w.lastCheckInAt || checkin > w.lastCheckInAt)) w.lastCheckInAt = checkin;
          const act = row.lastActivityAt;
          if (act && (!w.lastActivityAt || act > w.lastActivityAt)) w.lastActivityAt = act;
        }
        return row;
      });

      return { workers, liveRoutes };
    },
  });
}
