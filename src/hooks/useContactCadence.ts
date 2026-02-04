// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT CADENCE INTELLIGENCE HOOK
// Read-only visibility into contact communication cadence. NO AUTO-SEND.
// Implements Dynasty OS Pagination & Verification Contract
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePaginationState, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, createVerificationData } from './usePaginatedQuery';
import { useMemo } from 'react';

export interface ContactCadenceItem {
  contact_id: string;
  store_id: string;
  contact_name: string;
  phone: string;
  contact_role: string | null;
  is_primary: boolean;
  store_name: string | null;
  store_address: string | null;
  store_city: string | null;
  store_state: string | null;
  
  // Call metrics
  total_calls_attempted: number;
  total_calls_answered: number;
  last_call_attempt_at: string | null;
  last_call_answered_at: string | null;
  
  // Text metrics
  total_texts_sent: number;
  total_texts_received: number;
  last_text_sent_at: string | null;
  last_text_received_at: string | null;
  
  // Responsiveness
  responsiveness_status: 'responsive' | 'unresponsive' | 'pending' | 'unknown' | null;
  responsive_by_call: boolean;
  responsive_by_text: boolean;
  last_responded_at: string | null;
  
  // Cadence
  cadence_status: 'within_window' | 'due_soon' | 'overdue_7_days' | 'overdue_14_days' | 'never_contacted' | 'unknown';
  escalation_flag: boolean;
  cadence_updated_at: string | null;
  
  // Computed
  days_since_last_touch: number;
  last_touch_at: string;
  suggested_action: 'call' | 'text' | 'physical_visit';
  created_at: string;
}

export type CadenceFilter = 'all' | 'within_window' | 'due_soon' | 'overdue_7_days' | 'overdue_14_days' | 'never_contacted' | 'escalation';

export { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE };

/**
 * Fetch contacts with cadence intelligence - PAGINATED
 * READ-ONLY - No automation triggers
 * Dynasty OS Pagination & Verification Contract compliant
 */
export function useContactCadenceIntelligence(
  filter: CadenceFilter = 'all',
  storeId?: string
) {
  const pagination = usePaginationState(DEFAULT_PAGE_SIZE);
  const { page, pageSize, range, setTotalCount } = pagination;

  const query = useQuery({
    queryKey: ['contact-cadence-intelligence', filter, storeId, page, pageSize],
    queryFn: async () => {
      // Build base query with exact count
      let baseQuery = supabase
        .from('v_contact_cadence_intelligence')
        .select('*', { count: 'exact' })
        .order('days_since_last_touch', { ascending: false });

      // Apply filters
      if (filter === 'escalation') {
        baseQuery = baseQuery.eq('escalation_flag', true);
      } else if (filter !== 'all') {
        baseQuery = baseQuery.eq('cadence_status', filter);
      }

      if (storeId) {
        baseQuery = baseQuery.eq('store_id', storeId);
      }

      // Apply pagination range
      const { data, error, count } = await baseQuery.range(range.from, range.to);
      
      if (error) throw error;
      
      // Update total count for pagination controls
      if (count !== null) {
        setTotalCount(count);
      }

      return {
        items: (data || []) as ContactCadenceItem[],
        totalCount: count || 0,
      };
    },
  });

  // Create verification data for Dynasty OS compliance
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
 * Get cadence stats for Quick Stats cards
 * Uses aggregate query - NO LIMIT - always reflects full dataset
 */
export function useContactCadenceStats(storeId?: string) {
  return useQuery({
    queryKey: ['contact-cadence-stats', storeId],
    queryFn: async () => {
      let query = supabase
        .from('v_contact_cadence_intelligence')
        .select('cadence_status, escalation_flag, responsiveness_status');

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

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
  });
}

/**
 * Manually trigger cadence status recomputation
 * This is a human-initiated action, not automatic
 */
export function useRecomputeCadenceStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('compute_contact_cadence_status');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cadence status updated');
      queryClient.invalidateQueries({ queryKey: ['contact-cadence-intelligence'] });
      queryClient.invalidateQueries({ queryKey: ['contact-cadence-stats'] });
    },
    onError: (error) => {
      toast.error(`Failed to recompute: ${error.message}`);
    },
  });
}

/**
 * Get contacts due for outreach - PAGINATED
 */
export function useContactsDueForOutreach(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const range = { from: (page - 1) * pageSize, to: page * pageSize - 1 };
  
  return useQuery({
    queryKey: ['contacts-due-outreach', page, pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('v_contact_cadence_intelligence')
        .select('*', { count: 'exact' })
        .in('cadence_status', ['due_soon', 'overdue_7_days', 'overdue_14_days'])
        .order('days_since_last_touch', { ascending: false })
        .range(range.from, range.to);

      if (error) throw error;
      return {
        items: (data || []) as ContactCadenceItem[],
        totalCount: count || 0,
      };
    },
  });
}

/**
 * Get contacts requiring physical visit escalation - PAGINATED
 */
export function useContactsRequiringVisit(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const range = { from: (page - 1) * pageSize, to: page * pageSize - 1 };
  
  return useQuery({
    queryKey: ['contacts-requiring-visit', page, pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('v_contact_cadence_intelligence')
        .select('*', { count: 'exact' })
        .eq('escalation_flag', true)
        .order('days_since_last_touch', { ascending: false })
        .range(range.from, range.to);

      if (error) throw error;
      return {
        items: (data || []) as ContactCadenceItem[],
        totalCount: count || 0,
      };
    },
  });
}
