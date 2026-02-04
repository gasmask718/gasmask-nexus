// ═══════════════════════════════════════════════════════════════════════════════
// STORE-SCOPED CONTACT CADENCE INTELLIGENCE HOOK
// Filters existing v_contact_cadence_intelligence by store_id
// NO NEW CADENCE LOGIC - just a lens into the global system
// Dynasty OS Pagination & Verification Contract compliant
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ContactCadenceItem, CadenceFilter } from './useContactCadence';
import { usePaginationState, DEFAULT_PAGE_SIZE, createVerificationData } from './usePaginatedQuery';
import { useMemo } from 'react';

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
 * Fetch cadence intelligence for a single store - PAGINATED
 * This is a FILTER on the global view, not new logic
 */
export function useStoreCadenceIntelligence(
  storeId: string | undefined, 
  filter: CadenceFilter = 'all'
) {
  const pagination = usePaginationState(DEFAULT_PAGE_SIZE);
  const { page, pageSize, range, setTotalCount } = pagination;

  const query = useQuery({
    queryKey: ['store-cadence-intelligence', storeId, filter, page, pageSize],
    queryFn: async () => {
      if (!storeId) return { items: [], totalCount: 0 };
      
      let baseQuery = supabase
        .from('v_contact_cadence_intelligence')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId)
        .order('days_since_last_touch', { ascending: false });

      if (filter === 'escalation') {
        baseQuery = baseQuery.eq('escalation_flag', true);
      } else if (filter !== 'all') {
        baseQuery = baseQuery.eq('cadence_status', filter);
      }

      const { data, error, count } = await baseQuery.range(range.from, range.to);
      
      if (error) throw error;
      
      if (count !== null) {
        setTotalCount(count);
      }

      return {
        items: (data || []) as ContactCadenceItem[],
        totalCount: count || 0,
      };
    },
    enabled: !!storeId,
  });

  const verification = useMemo(() => {
    if (!query.data) return null;
    return createVerificationData(
      query.data.items,
      query.data.totalCount,
      page,
      pageSize
    );
  }, [query.data, page, pageSize]);

  return {
    data: query.data?.items || [],
    totalCount: query.data?.totalCount || 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: pagination.totalPages,
      totalCount: pagination.totalCount,
    },
    controls: pagination.controls,
    verification,
  };
}

/**
 * Get cadence stats for a single store
 * Uses aggregate query - NO LIMIT - always reflects full dataset
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

      // No limit - aggregate stats must always reflect full dataset
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
