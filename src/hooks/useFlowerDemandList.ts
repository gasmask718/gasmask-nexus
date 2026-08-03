import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FlowerDemandRow {
  store_id: string;
  store_name: string | null;
  nickname: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  borough_id: string | null;
  borough: string | null;
  store_phone: string | null;
  store_status: string | null;
  last_visit_at: string | null;
  flower_note: string | null;
  flagged_at: string | null;
  flagged_by_id: string | null;
  flagged_by_name: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_phone: string | null;
}

export type FlowerSortKey =
  | 'store_name'
  | 'borough'
  | 'flagged_at'
  | 'flagged_by_name'
  | 'last_visit_at';

export interface FlowerDemandFilters {
  search: string;
  borough: string; // '' = all
  flaggedBy: string; // '' = all
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
  sortKey: FlowerSortKey;
  sortAsc: boolean;
  page: number;
  pageSize: number;
}

export const DEFAULT_FLOWER_FILTERS: FlowerDemandFilters = {
  search: '',
  borough: '',
  flaggedBy: '',
  from: '',
  to: '',
  sortKey: 'flagged_at',
  sortAsc: false,
  page: 0,
  pageSize: 25,
};

function applyFilters(
  builder: ReturnType<typeof supabase.from>,
  f: FlowerDemandFilters,
) {
  let q = builder as any;
  if (f.search.trim()) {
    const term = `%${f.search.trim().replace(/[%,]/g, '')}%`;
    q = q.or(
      [
        `store_name.ilike.${term}`,
        `nickname.ilike.${term}`,
        `address.ilike.${term}`,
        `contact_name.ilike.${term}`,
        `store_phone.ilike.${term}`,
        `flower_note.ilike.${term}`,
      ].join(','),
    );
  }
  if (f.borough) q = q.eq('borough', f.borough);
  if (f.flaggedBy) q = q.eq('flagged_by_id', f.flaggedBy);
  if (f.from) q = q.gte('flagged_at', `${f.from}T00:00:00`);
  if (f.to) q = q.lte('flagged_at', `${f.to}T23:59:59`);
  return q;
}

/** Server-side paginated demand list: stores flagged as flower buyers. */
export function useFlowerDemandList(filters: FlowerDemandFilters) {
  return useQuery({
    queryKey: ['flower-demand-list', filters],
    queryFn: async () => {
      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;

      let q = applyFilters(
        supabase.from('v_flower_demand_list').select('*', { count: 'exact' }) as any,
        filters,
      );
      q = q
        .order(filters.sortKey, { ascending: filters.sortAsc, nullsFirst: false })
        .range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data ?? []) as FlowerDemandRow[],
        total: count ?? 0,
      };
    },
  });
}

/** Distinct filter options, derived from the full flagged set (not the page). */
export function useFlowerDemandFacets() {
  return useQuery({
    queryKey: ['flower-demand-facets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_flower_demand_list')
        .select('borough, flagged_by_id, flagged_by_name');
      if (error) throw error;

      const boroughs = new Set<string>();
      const flaggers = new Map<string, string>();
      for (const r of (data ?? []) as FlowerDemandRow[]) {
        if (r.borough) boroughs.add(r.borough);
        if (r.flagged_by_id) {
          flaggers.set(r.flagged_by_id, r.flagged_by_name || 'Unknown user');
        }
      }
      return {
        boroughs: [...boroughs].sort(),
        flaggers: [...flaggers.entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Full (unpaginated) export honouring the active filters. */
export async function fetchFlowerDemandForExport(filters: FlowerDemandFilters) {
  const pageSize = 1000;
  const all: FlowerDemandRow[] = [];
  for (let page = 0; ; page++) {
    let q = applyFilters(
      supabase.from('v_flower_demand_list').select('*') as any,
      filters,
    );
    q = q
      .order(filters.sortKey, { ascending: filters.sortAsc, nullsFirst: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as FlowerDemandRow[];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}
