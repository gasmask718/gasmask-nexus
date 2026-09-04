import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContactResponsivenessStats {
  contact_id: string;
  contact_name: string;
  phone: string | null;
  email: string | null;
  store_id: string;
  store_name: string;
  role: string | null;
  is_primary: boolean | null;
  total_calls_attempted: number;
  total_calls_answered: number;
  last_call_attempt_at: string | null;
  last_call_answered_at: string | null;
  total_texts_sent: number;
  total_texts_received: number;
  last_text_sent_at: string | null;
  last_text_received_at: string | null;
  responsive_by_call: boolean | null;
  responsive_by_text: boolean | null;
  responsiveness_status: 'responsive' | 'unresponsive' | 'unknown';
  last_responded_at: string | null;
  call_answer_rate: number;
  text_reply_rate: number;
}

export function useContactResponsiveness(storeId?: string) {
  return useQuery({
    queryKey: ['contact-responsiveness', storeId],
    queryFn: async () => {
      let query = supabase
        .from('store_contacts')
        .select(`
          id,
          name,
          phone,
          email,
          store_id,
          role,
          is_primary,
          total_calls_attempted,
          total_calls_answered,
          last_call_attempt_at,
          last_call_answered_at,
          total_texts_sent,
          total_texts_received,
          last_text_sent_at,
          last_text_received_at,
          responsive_by_call,
          responsive_by_text,
          responsiveness_status,
          last_responded_at,
          stores!inner(name)
        `)
        .is('deleted_at', null)
        .eq('is_simulation', false);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query.order('is_primary', { ascending: false });

      if (error) throw error;
      
      // Transform to match expected interface
      return (data || []).map((item: any) => ({
        contact_id: item.id,
        contact_name: item.name,
        phone: item.phone,
        email: item.email,
        store_id: item.store_id,
        store_name: item.stores?.name || 'Unknown Store',
        role: item.role,
        is_primary: item.is_primary,
        total_calls_attempted: item.total_calls_attempted || 0,
        total_calls_answered: item.total_calls_answered || 0,
        last_call_attempt_at: item.last_call_attempt_at,
        last_call_answered_at: item.last_call_answered_at,
        total_texts_sent: item.total_texts_sent || 0,
        total_texts_received: item.total_texts_received || 0,
        last_text_sent_at: item.last_text_sent_at,
        last_text_received_at: item.last_text_received_at,
        responsive_by_call: item.responsive_by_call,
        responsive_by_text: item.responsive_by_text,
        responsiveness_status: (item.responsiveness_status || 'unknown') as 'responsive' | 'unresponsive' | 'unknown',
        last_responded_at: item.last_responded_at,
        call_answer_rate: item.total_calls_attempted > 0 
          ? Math.round((item.total_calls_answered / item.total_calls_attempted) * 100) 
          : 0,
        text_reply_rate: item.total_texts_sent > 0 
          ? Math.round((item.total_texts_received / item.total_texts_sent) * 100) 
          : 0,
      })) as ContactResponsivenessStats[];
    },
    enabled: true,
  });
}

export function useContactResponsivenessSummary() {
  return useQuery({
    queryKey: ['contact-responsiveness-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_contacts')
        .select('responsiveness_status, total_calls_attempted, total_texts_sent')
        .is('deleted_at', null)
        .eq('is_simulation', false);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        responsive: data?.filter(c => c.responsiveness_status === 'responsive').length || 0,
        unresponsive: data?.filter(c => c.responsiveness_status === 'unresponsive').length || 0,
        neverContacted: data?.filter(c => 
          (c.responsiveness_status === 'unknown' || !c.responsiveness_status) && 
          ((c.total_calls_attempted || 0) === 0) && 
          ((c.total_texts_sent || 0) === 0)
        ).length || 0,
        unknown: data?.filter(c => c.responsiveness_status === 'unknown' || !c.responsiveness_status).length || 0,
      };

      return stats;
    },
  });
}

export function useStoreContactsWithResponsiveness(storeId: string) {
  return useQuery({
    queryKey: ['store-contacts-responsiveness', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_contacts')
        .select(`
          id,
          store_id,
          name,
          role,
          phone,
          email,
          is_primary,
          can_receive_sms,
          influence_level,
          notes,
          phone_note,
          total_calls_attempted,
          total_calls_answered,
          last_call_attempt_at,
          last_call_answered_at,
          total_texts_sent,
          total_texts_received,
          last_text_sent_at,
          last_text_received_at,
          responsive_by_call,
          responsive_by_text,
          responsiveness_status,
          last_responded_at,
          created_at,
          number_verification_status,
          number_verification_sent_at,
          number_verification_delivered_at,
          number_verification_confirmed_at,
          number_verification_error,
          owner_confirmed,
          owner_confirmed_at,
          owner_confirmed_by,
          is_homie,
          homie_set_at,
          homie_set_by,
          shirt_size,
          gift_request
        `)
        .is('deleted_at', null)
        .eq('store_id', storeId)
        .eq('is_simulation', false)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });
}
