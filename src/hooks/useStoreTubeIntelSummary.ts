import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH STORE TUBE INTEL SUMMARY HOOK
// Fetches aggregated tube intelligence attribution for KPI card overlays.
// One row per store — batched for directory views.
// ═══════════════════════════════════════════════════════════════════════════════

export type UpdateMethod = 'in_person' | 'call' | 'text' | 'system';

export interface TubeIntelSummary {
  store_id: string;
  most_recent_update: string | null;
  oldest_update: string | null;
  method_count: number;
  methods: UpdateMethod[];
}

/**
 * Fetch tube intel summary for multiple stores in one query.
 * Returns a Map of store_id -> TubeIntelSummary.
 */
export function useStoreTubeIntelSummaryBatch(storeIds: string[]) {
  return useQuery({
    queryKey: ['store-tube-intel-summary-batch', storeIds.sort().join(',')],
    queryFn: async () => {
      if (!storeIds.length) return new Map<string, TubeIntelSummary>();

      const CHUNK_SIZE = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < storeIds.length; i += CHUNK_SIZE) {
        chunks.push(storeIds.slice(i, i + CHUNK_SIZE));
      }

      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase.from('v_store_tube_intel_summary').select('*').in('store_id', chunk)
        )
      );

      const firstError = results.find((r) => r.error);
      if (firstError?.error) {
        console.error('[INTEL-SUMMARY-BATCH] Failed to fetch:', firstError.error);
        throw firstError.error;
      }

      const data = results.flatMap((r) => r.data || []);

      const map = new Map<string, TubeIntelSummary>();
      for (const row of (data || []) as TubeIntelSummary[]) {
        map.set(row.store_id, row);
      }
      return map;
    },
    enabled: storeIds.length > 0,
    staleTime: 30_000,
  });
}

/**
 * Fetch tube intel summary for a SINGLE store (used in StoreCard / map popup).
 */
export function useStoreTubeIntelSummary(storeId: string | null) {
  return useQuery({
    queryKey: ['store-tube-intel-summary', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .from('v_store_tube_intel_summary')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error) {
        console.error('[INTEL-SUMMARY] Failed to fetch:', error);
        throw error;
      }

      return (data as TubeIntelSummary) || null;
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}
