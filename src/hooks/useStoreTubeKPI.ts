 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 
 // ═══════════════════════════════════════════════════════════════════════════════
 // STORE TUBE KPI HOOK
 // Single source of truth for tube inventory + order intelligence per store
 // ═══════════════════════════════════════════════════════════════════════════════
 
 export interface StoreTubeKPIRow {
   store_id: string;
   brand_id: string;
   brand_name: string;
   tube_count: number;
   last_order_date: string | null;
   last_order_label: string;
   color_status: 'green' | 'yellow' | 'red' | 'muted';
   needs_order: boolean;
   bring_samples: boolean;
   bring_starter_kit: boolean;
   owner_interested: boolean | null;
   inventory_updated_at: string | null;
 }
 
 // Brand color mapping (consistent with existing brand colors)
 export const TUBE_KPI_BRAND_COLORS: Record<string, string> = {
   gasmask: '#EF4444',      // red-500
   gasmasktubes: '#3B82F6', // blue-500
   hotmama: '#EC4899',      // pink-500
   grabba: '#A855F7',       // purple-500
   'hotscolatti-light': '#FBBF24', // amber-400
   'hotscolatti-dark': '#92400E',  // amber-800
   fronto: '#22C55E',       // green-500
 };
 
 /**
  * Fetch tube KPI data for a store from the v_store_tube_kpi view
  * Returns all tube inventory products with tube counts, last order dates, and color status
  */
 export function useStoreTubeKPI(storeId: string | null) {
   return useQuery({
     queryKey: ['store-tube-kpi', storeId],
     queryFn: async () => {
       if (!storeId) return [];
 
       const { data, error } = await supabase
         .from('v_store_tube_kpi')
         .select('*')
         .eq('store_id', storeId)
         .order('brand_name');
 
       if (error) {
         console.error('Failed to fetch tube KPI:', error);
         throw error;
       }
 
       return (data || []) as StoreTubeKPIRow[];
     },
     enabled: !!storeId,
     staleTime: 30_000, // 30 seconds
   });
 }
 
 /**
  * Get color class based on color_status from the view
  */
 export function getColorStatusClasses(status: StoreTubeKPIRow['color_status']) {
   switch (status) {
     case 'green':
       return {
         bg: 'bg-green-500/10',
         border: 'border-green-500/30',
         text: 'text-green-600 dark:text-green-400',
         dot: 'bg-green-500',
       };
     case 'yellow':
       return {
         bg: 'bg-amber-500/10',
         border: 'border-amber-500/30',
         text: 'text-amber-600 dark:text-amber-400',
         dot: 'bg-amber-500',
       };
     case 'red':
       return {
         bg: 'bg-red-500/10',
         border: 'border-red-500/30',
         text: 'text-red-600 dark:text-red-400',
         dot: 'bg-red-500',
       };
     case 'muted':
     default:
       return {
         bg: 'bg-muted/30',
         border: 'border-muted/50',
         text: 'text-muted-foreground',
         dot: 'bg-muted-foreground',
       };
   }
 }