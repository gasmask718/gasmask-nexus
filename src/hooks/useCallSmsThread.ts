import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCallSmsThread(phone: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['call-sms-thread', phone],
    queryFn: async () => {
      if (!phone) return [];
      const normalized = phone.replace(/\D/g, '').slice(-10);

      const { data, error } = await supabase
        .from('outreach_sms')
        .select('*')
        .ilike('phone', `%${normalized}%`)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!phone,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!phone) return;
    const normalized = phone.replace(/\D/g, '').slice(-10);

    const channel = supabase
      .channel(`sms-thread-${normalized}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'outreach_sms' },
        (payload) => {
          const newMsg = payload.new as any;
          const msgPhone = (newMsg.phone || '').replace(/\D/g, '').slice(-10);
          if (msgPhone === normalized) {
            queryClient.invalidateQueries({ queryKey: ['call-sms-thread', phone] });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [phone, queryClient]);

  return query;
}
