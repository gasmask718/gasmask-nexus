import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InstinctFeedItem {
  id: string;
  action_type: string;
  reasoning: string;
  decision_path: any;
  confidence_score: number;
  created_at: string;
  worker_id: string | null;
  task_id: string | null;
}

export function useInstinctFeed(limit = 50) {
  const [realtimeItems, setRealtimeItems] = useState<InstinctFeedItem[]>([]);

  const { data: initialItems, isLoading } = useQuery({
    queryKey: ['instinct-feed', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_instinct_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as InstinctFeedItem[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('instinct-feed-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_instinct_log' },
        (payload) => {
          setRealtimeItems(prev => [payload.new as InstinctFeedItem, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [limit]);

  const items = [...realtimeItems, ...(initialItems || [])].slice(0, limit);

  return { items, loading: isLoading };
}
