 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import type { StoreTubeKPIRow } from './useStoreTubeKPI';
 
 // ═══════════════════════════════════════════════════════════════════════════════
 // BATCH STORE TUBE KPI HOOK
 // Fetches tube KPI data for MULTIPLE stores at once (for directory views)
 // This prevents N+1 queries when rendering store cards
 // ═══════════════════════════════════════════════════════════════════════════════
 
 export interface StoreKPISummary {
   store_id: string;
   totalTubes: number;
   brandCount: number;
   hasNeverOrdered: boolean;
   hasOutOfStock: boolean;
   needsAction: boolean;
   kpiRows: StoreTubeKPIRow[];
   verified: boolean;
 }
 
 /**
  * Fetch tube KPI data for multiple stores in a single query
  * Returns a map of store_id -> KPI summary
  */
 export function useStoreTubeKPIBatch(storeIds: string[]) {
   return useQuery({
     queryKey: ['store-tube-kpi-batch', storeIds.sort().join(',')],
     queryFn: async () => {
       if (!storeIds.length) return new Map<string, StoreKPISummary>();
 
       // Fetch all KPI rows for all stores in one query
       const { data, error } = await supabase
         .from('v_store_tube_kpi')
         .select('*')
         .in('store_id', storeIds)
         .order('brand_name');
 
       if (error) {
         console.error('[KPI-BATCH] Failed to fetch tube KPI:', error);
         throw error;
       }
 
       // Group by store_id and compute summaries
       const kpiMap = new Map<string, StoreKPISummary>();
 
       // Initialize all stores with empty state
       for (const storeId of storeIds) {
         kpiMap.set(storeId, {
           store_id: storeId,
           totalTubes: 0,
           brandCount: 0,
           hasNeverOrdered: false,
           hasOutOfStock: false,
           needsAction: false,
           kpiRows: [],
           verified: true, // Verified means we queried for this store
         });
       }
 
       // Process returned rows
       for (const row of (data || []) as StoreTubeKPIRow[]) {
         const summary = kpiMap.get(row.store_id);
         if (summary) {
           summary.kpiRows.push(row);
           summary.totalTubes += row.tube_count || 0;
           summary.brandCount += 1;
           if (!row.last_order_date) summary.hasNeverOrdered = true;
           if (row.tube_count === 0) summary.hasOutOfStock = true;
           if (row.needs_order || row.bring_samples || row.bring_starter_kit) {
             summary.needsAction = true;
           }
         }
       }
 
       // Log verification
       const verifiedCount = storeIds.length;
       const withDataCount = Array.from(kpiMap.values()).filter(s => s.brandCount > 0).length;
       console.log(`[KPI-BATCH] Verified ${verifiedCount} stores, ${withDataCount} have tube data`);
 
       return kpiMap;
     },
     enabled: storeIds.length > 0,
     staleTime: 30_000, // 30 seconds
   });
 }
 
 /**
  * Get color status for a store's overall KPI state
  */
 export function getStoreKPIStatusColor(summary: StoreKPISummary | undefined): string {
   if (!summary || summary.brandCount === 0) {
     return 'bg-muted/50 text-muted-foreground border-muted';
   }
   if (summary.hasOutOfStock) {
     return 'bg-red-500/10 text-red-500 border-red-500/30';
   }
   if (summary.hasNeverOrdered) {
     return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
   }
   return 'bg-green-500/10 text-green-500 border-green-500/30';
 }