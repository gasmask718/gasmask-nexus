import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useEventSpaces() {
  return useQuery({
    queryKey: ['event-spaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_spaces')
        .select('*, event_space_partners(name), event_space_features(feature), event_space_images(id, image_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useEventSpacePartners() {
  return useQuery({
    queryKey: ['event-space-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_space_partners')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertEventSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (space: Record<string, any>) => {
      const { data, error } = await supabase
        .from('event_spaces')
        .upsert(space as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-spaces'] });
      toast.success('Space saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteEventSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_spaces').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-spaces'] });
      toast.success('Space deleted');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpsertPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partner: Record<string, any>) => {
      const { data, error } = await supabase
        .from('event_space_partners')
        .upsert(partner as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-space-partners'] });
      toast.success('Partner saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useEventSpaceStats() {
  return useQuery({
    queryKey: ['event-space-stats'],
    queryFn: async () => {
      const [spaces, partners] = await Promise.all([
        supabase.from('event_spaces').select('id, status, base_price, category'),
        supabase.from('event_space_partners').select('id, status'),
      ]);
      const allSpaces = spaces.data || [];
      const allPartners = partners.data || [];
      return {
        totalSpaces: allSpaces.length,
        liveSpaces: allSpaces.filter(s => s.status === 'live').length,
        avgPrice: allSpaces.length
          ? Math.round(allSpaces.reduce((a, s) => a + (Number(s.base_price) || 0), 0) / allSpaces.length)
          : 0,
        totalPartners: allPartners.length,
        pendingPartners: allPartners.filter(p => p.status === 'pending').length,
        categories: [...new Set(allSpaces.map(s => s.category))],
      };
    },
  });
}

export function useManageFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ spaceId, features }: { spaceId: string; features: string[] }) => {
      await supabase.from('event_space_features').delete().eq('event_space_id', spaceId);
      if (features.length > 0) {
        const rows = features.map(f => ({ event_space_id: spaceId, feature: f }));
        const { error } = await supabase.from('event_space_features').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-spaces'] });
      toast.success('Features updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
