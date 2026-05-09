// Bulk fetch all rows from v_store_tube_summary, paginated, returns Map for O(1) lookup.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { StoreTubeSummary } from './useStoreTubeSummary';

export function useStoreTubeSummariesBulk() {
  const query = useQuery({
    queryKey: ['store-tube-summaries-bulk'],
    staleTime: 60_000,
    queryFn: async (): Promise<StoreTubeSummary[]> => {
      const all: StoreTubeSummary[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('v_store_tube_summary' as any)
          .select('*')
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`STORE_TUBE_SUMMARIES_BULK_FAILED: ${error.message}`);
        const rows = (data || []) as unknown as StoreTubeSummary[];
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  const map = useMemo(() => {
    const m = new Map<string, StoreTubeSummary>();
    (query.data || []).forEach(r => { if (r.store_id) m.set(r.store_id, r); });
    return m;
  }, [query.data]);

  return { ...query, map, summaries: query.data || [] };
}
