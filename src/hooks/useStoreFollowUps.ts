// ═══════════════════════════════════════════════════════════════════════════════
// STORE FOLLOW-UPS HOOK — Fetch follow-ups for a specific store
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FollowUpQueueItem } from '@/hooks/useFollowUps';

export function useStoreFollowUps(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-follow-ups', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('follow_up_queue')
        .select(`
          *,
          store:store_master(id, store_name, phone, address),
          business:businesses(id, name),
          vertical:brand_verticals(id, name, slug)
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        ...item,
        store: item.store ? { id: item.store.id, name: item.store.store_name } : null,
        business: item.business ? { id: item.business.id, name: item.business.name } : null,
        vertical: item.vertical ? { id: item.vertical.id, name: item.vertical.name, slug: item.vertical.slug } : null,
      })) as FollowUpQueueItem[];
    },
    enabled: !!storeId,
  });
}

export function useNextStoreFollowUp(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-next-follow-up', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .from('follow_up_queue')
        .select(`
          *,
          store:store_master(id, store_name, phone, address),
          business:businesses(id, name),
          vertical:brand_verticals(id, name, slug)
        `)
        .eq('store_id', storeId)
        .in('status', ['pending', 'overdue'])
        .order('due_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const item = data as any;
      return {
        ...item,
        store: item.store ? { id: item.store.id, name: item.store.store_name } : null,
        business: item.business ? { id: item.business.id, name: item.business.name } : null,
        vertical: item.vertical ? { id: item.vertical.id, name: item.vertical.name, slug: item.vertical.slug } : null,
      } as FollowUpQueueItem;
    },
    enabled: !!storeId,
  });
}
