// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT CADENCE INTELLIGENCE HOOK
// Read-only visibility into contact communication cadence. NO AUTO-SEND.
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

/**
 * Fetch all contacts with cadence intelligence
 * READ-ONLY - No automation triggers
 */
export function useContactCadenceIntelligence(filter: CadenceFilter = 'all') {
  return useQuery({
    queryKey: ['contact-cadence-intelligence', filter],
    queryFn: async () => {
      let query = supabase
        .from('v_contact_cadence_intelligence')
        .select('*')
        .order('days_since_last_touch', { ascending: false });

      if (filter === 'escalation') {
        query = query.eq('escalation_flag', true);
      } else if (filter !== 'all') {
        query = query.eq('cadence_status', filter);
      }

      const { data, error } = await query.limit(500);
      
      if (error) throw error;
      return (data || []) as ContactCadenceItem[];
    },
  });
}

/**
 * Get cadence stats for Quick Stats cards
 */
export function useContactCadenceStats() {
  return useQuery({
    queryKey: ['contact-cadence-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_contact_cadence_intelligence')
        .select('cadence_status, escalation_flag, responsiveness_status');

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
 * Get contacts due for outreach (7+ days since last touch)
 */
export function useContactsDueForOutreach() {
  return useQuery({
    queryKey: ['contacts-due-outreach'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_contact_cadence_intelligence')
        .select('*')
        .in('cadence_status', ['due_soon', 'overdue_7_days', 'overdue_14_days'])
        .order('days_since_last_touch', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as ContactCadenceItem[];
    },
  });
}

/**
 * Get contacts requiring physical visit escalation
 */
export function useContactsRequiringVisit() {
  return useQuery({
    queryKey: ['contacts-requiring-visit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_contact_cadence_intelligence')
        .select('*')
        .eq('escalation_flag', true)
        .order('days_since_last_touch', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as ContactCadenceItem[];
    },
  });
}
