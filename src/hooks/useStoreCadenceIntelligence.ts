// ═══════════════════════════════════════════════════════════════════════════════
// STORE-SCOPED CONTACT CADENCE INTELLIGENCE HOOK
// Filters existing v_contact_cadence_intelligence by store_id
// NO NEW CADENCE LOGIC - just a lens into the global system
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ContactCadenceItem, CadenceFilter } from './useContactCadence';

export interface StoreCadenceStats {
  withinWindow: number;
  dueSoon: number;
  overdue7Days: number;
  overdue14Days: number;
  neverContacted: number;
  escalationRequired: number;
  unresponsive: number;
  total: number;
}

/**
 * Fetch cadence intelligence for a single store
 * This is a FILTER on the global view, not new logic
 */
export function useStoreCadenceIntelligence(storeId: string | undefined, filter: CadenceFilter = 'all') {
  return useQuery({
    queryKey: ['store-cadence-intelligence', storeId, filter],
    queryFn: async () => {
      if (!storeId) return [];
      
      let query = supabase
        .from('v_contact_cadence_intelligence')
        .select('*')
        .eq('store_id', storeId)
        .order('days_since_last_touch', { ascending: false });

      if (filter === 'escalation') {
        query = query.eq('escalation_flag', true);
      } else if (filter !== 'all') {
        query = query.eq('cadence_status', filter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as ContactCadenceItem[];
    },
    enabled: !!storeId,
  });
}

/**
 * Get cadence stats for a single store
 * Matches EXACTLY what global would show if filtered by this store
 */
export function useStoreCadenceStats(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-cadence-stats', storeId],
    queryFn: async (): Promise<StoreCadenceStats> => {
      if (!storeId) {
        return {
          withinWindow: 0,
          dueSoon: 0,
          overdue7Days: 0,
          overdue14Days: 0,
          neverContacted: 0,
          escalationRequired: 0,
          unresponsive: 0,
          total: 0,
        };
      }

      const { data, error } = await supabase
        .from('v_contact_cadence_intelligence')
        .select('cadence_status, escalation_flag, responsiveness_status')
        .eq('store_id', storeId);

      if (error) throw error;

      const items = data || [];
      
      return {
        withinWindow: items.filter(i => i.cadence_status === 'within_window').length,
        dueSoon: items.filter(i => i.cadence_status === 'due_soon').length,
        overdue7Days: items.filter(i => i.cadence_status === 'overdue_7_days').length,
        overdue14Days: items.filter(i => i.cadence_status === 'overdue_14_days').length,
        neverContacted: items.filter(i => i.cadence_status === 'never_contacted').length,
        escalationRequired: items.filter(i => i.escalation_flag === true).length,
        unresponsive: items.filter(i => i.responsiveness_status === 'unresponsive').length,
        total: items.length,
      };
    },
    enabled: !!storeId,
  });
}
