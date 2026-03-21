import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useMissedCalls() {
  return useQuery({
    queryKey: ['missed-calls'],
    queryFn: async () => {
      // Primary: outreach_calls with no_answer/missed/voicemail outcomes
      const { data: noAnswerCalls, error: e1 } = await (supabase as any)
        .from('outreach_calls')
        .select(`
          id,
          call_date,
          duration_seconds,
          outcome,
          elevenlabs_call_id,
          lead_id,
          outreach_leads(id, store_name, contact_name, phone, status)
        `)
        .in('outcome', ['no_answer', 'missed', 'voicemail', 'hung_up'])
        .order('call_date', { ascending: false })
        .limit(200);

      if (!e1 && noAnswerCalls?.length) return noAnswerCalls;

      // Fallback: outreach_calls with null outcome (attempted but no result)
      const { data: attemptedCalls } = await (supabase as any)
        .from('outreach_calls')
        .select(`
          id, call_date, duration_seconds, outcome,
          lead_id,
          outreach_leads(id, store_name, contact_name, phone)
        `)
        .is('outcome', null)
        .order('call_date', { ascending: false })
        .limit(200);

      return attemptedCalls || [];
    },
  });
}
