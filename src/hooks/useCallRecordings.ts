import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCallRecordings(filters?: { outcome?: string; dateFrom?: string }) {
  return useQuery({
    queryKey: ['call-recordings', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('outreach_calls')
        .select(`
          id,
          elevenlabs_call_id,
          call_date,
          duration_seconds,
          outcome,
          call_score,
          transcript,
          language_detected,
          notes,
          lead_id,
          outreach_leads(store_name, contact_name, phone)
        `)
        .order('call_date', { ascending: false })
        .limit(100);

      if (filters?.outcome) query = query.eq('outcome', filters.outcome);
      if (filters?.dateFrom) query = query.gte('call_date', filters.dateFrom);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}
