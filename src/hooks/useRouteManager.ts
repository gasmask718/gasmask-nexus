// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE MANAGER HOOK — Single Source of Truth for All Dispatched Routes
// Reads from routes table only. Never creates parallel state.
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePaginationState, calculateRange } from './usePaginatedQuery';
import { useState, useMemo, useCallback, useEffect } from 'react';

export interface RouteManagerFilters {
  status: string;
  type: string;
  territory: string;
  brand: string;
  profitBand: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

export const DEFAULT_FILTERS: RouteManagerFilters = {
  status: 'all',
  type: 'all',
  territory: 'all',
  brand: 'all',
  profitBand: 'all',
  dateFrom: '',
  dateTo: '',
  search: '',
};

export interface RouteRow {
  id: string;
  date: string;
  status: string | null;
  type: string;
  territory: string | null;
  brand_ids: string[] | null;
  assigned_to: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  route_state: string | null;
  estimated_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  // Joined
  assignee?: { id: string; name: string | null; role: string | null } | null;
  stop_count: number;
  completed_stops: number;
  profit_score: number | null;
}

export function useRouteManager() {
  const [filters, setFilters] = useState<RouteManagerFilters>(DEFAULT_FILTERS);
  const pagination = usePaginationState(50);
  const queryClient = useQueryClient();

  // Reset page on filter change
  const updateFilter = useCallback((key: keyof RouteManagerFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    pagination.controls.goToFirst();
  }, [pagination.controls]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    pagination.controls.goToFirst();
  }, [pagination.controls]);

  // Main query: routes with assignee + stop counts + profit
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['route-manager', filters, pagination.page, pagination.pageSize],
    queryFn: async () => {
      const { from, to } = calculateRange(pagination.page, pagination.pageSize);

      // Build query
      let query = supabase
        .from('routes')
        .select(`
          id, date, status, type, territory, brand_ids,
          assigned_to, created_at, started_at, completed_at,
          route_state, estimated_duration_minutes, actual_duration_minutes,
          assignee:profiles!routes_assigned_to_fkey(id, name, role)
        `, { count: 'exact' })
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }
      if (filters.territory !== 'all') {
        query = query.eq('territory', filters.territory);
      }
      if (filters.brand !== 'all') {
        query = query.contains('brand_ids', [filters.brand]);
      }
      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo);
      }

      query = query.range(from, to);

      const { data: routes, error, count } = await query;
      if (error) throw error;

      const routeIds = (routes || []).map(r => r.id);

      // Fetch stop counts per route
      let stopCounts: Record<string, { total: number; completed: number }> = {};
      if (routeIds.length > 0) {
        const { data: stops } = await supabase
          .from('route_stops')
          .select('route_id, status')
          .in('route_id', routeIds);

        if (stops) {
          for (const s of stops) {
            if (!s.route_id) continue;
            if (!stopCounts[s.route_id]) stopCounts[s.route_id] = { total: 0, completed: 0 };
            stopCounts[s.route_id].total++;
            if (s.status === 'completed' || s.status === 'visited') {
              stopCounts[s.route_id].completed++;
            }
          }
        }
      }

      // Fetch profit scores
      let profitScores: Record<string, number> = {};
      if (routeIds.length > 0) {
        const { data: profits } = await supabase
          .from('route_profit_metrics')
          .select('route_id, profit_score')
          .in('route_id', routeIds);

        if (profits) {
          for (const p of profits) {
            profitScores[p.route_id] = p.profit_score;
          }
        }
      }

      // Compose rows
      const rows: RouteRow[] = (routes || []).map(r => ({
        ...r,
        assignee: r.assignee as any,
        stop_count: stopCounts[r.id]?.total || 0,
        completed_stops: stopCounts[r.id]?.completed || 0,
        profit_score: profitScores[r.id] ?? null,
      }));

      // Client-side profit band filter (since it's derived data)
      let filtered = rows;
      if (filters.profitBand !== 'all') {
        filtered = rows.filter(r => {
          if (r.profit_score === null) return filters.profitBand === 'none';
          if (filters.profitBand === 'high') return r.profit_score >= 70;
          if (filters.profitBand === 'medium') return r.profit_score >= 40 && r.profit_score < 70;
          if (filters.profitBand === 'low') return r.profit_score < 40;
          return true;
        });
      }

      return { rows: filtered, totalCount: count || 0 };
    },
  });

  // Update pagination total count
  useEffect(() => {
    if (data?.totalCount !== undefined) {
      pagination.setTotalCount(data.totalCount);
    }
  }, [data?.totalCount]);

  // Stats summary
  const stats = useQuery({
    queryKey: ['route-manager-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const [
        { count: total },
        { count: active },
        { count: completed },
        { count: todayCount },
      ] = await Promise.all([
        supabase.from('routes').select('id', { count: 'exact', head: true }),
        supabase.from('routes').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress', 'active']),
        supabase.from('routes').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('routes').select('id', { count: 'exact', head: true }).eq('date', today),
      ]);

      return {
        total: total || 0,
        active: active || 0,
        completed: completed || 0,
        today: todayCount || 0,
      };
    },
  });

  // Territories for filter dropdown
  const { data: territories = [] } = useQuery({
    queryKey: ['route-territories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('routes')
        .select('territory')
        .not('territory', 'is', null)
        .limit(500);

      const unique = [...new Set((data || []).map(r => r.territory).filter(Boolean))];
      return unique.sort() as string[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Brands for filter dropdown (from brand_ids arrays)
  const { data: brands = [] } = useQuery({
    queryKey: ['route-brands'],
    queryFn: async () => {
      const { data } = await supabase
        .from('routes')
        .select('brand_ids')
        .not('brand_ids', 'is', null)
        .limit(500);

      const allBrands = (data || []).flatMap(r => r.brand_ids || []);
      const unique = [...new Set(allBrands)];
      return unique.sort();
    },
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['route-manager'] });
    queryClient.invalidateQueries({ queryKey: ['route-manager-stats'] });
  }, [queryClient]);

  return {
    routes: data?.rows || [],
    isLoading,
    error,
    refetch,
    invalidate,
    filters,
    updateFilter,
    resetFilters,
    pagination,
    stats: stats.data || { total: 0, active: 0, completed: 0, today: 0 },
    territories,
    brands,
  };
}

// Route detail: full stops + payouts + profit + interventions
export function useRouteDetail(routeId: string | null) {
  return useQuery({
    queryKey: ['route-detail', routeId],
    queryFn: async () => {
      if (!routeId) return null;

      const [routeRes, stopsRes, profitRes, payoutRes, interventionsRes] = await Promise.all([
        supabase
          .from('routes')
          .select(`*, assignee:profiles!routes_assigned_to_fkey(id, name, role)`)
          .eq('id', routeId)
          .single(),
        (supabase as any)
          .from('route_stops')
          .select(`*, store:store_master!route_stops_store_id_fkey(id, store_name, address, territory)`)
          .eq('route_id', routeId)
          .order('planned_order', { ascending: true }),
        supabase
          .from('route_profit_metrics')
          .select('*')
          .eq('route_id', routeId)
          .maybeSingle(),
        supabase
          .from('worker_payouts')
          .select('*')
          .eq('route_id', routeId)
          .maybeSingle(),
        supabase
          .from('dispatch_interventions')
          .select(`*, performer:profiles!dispatch_interventions_performed_by_fkey(id, name, role)`)
          .eq('route_id', routeId)
          .order('created_at', { ascending: false }),
      ]);

      return {
        route: routeRes.data,
        stops: stopsRes.data || [],
        profit: profitRes.data,
        payout: payoutRes.data,
        interventions: interventionsRes.data || [],
      };
    },
    enabled: !!routeId,
  });
}
