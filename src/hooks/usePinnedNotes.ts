import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PinnedNote {
  id: string;
  store_id: string;
  contact_id: string | null;
  note_text: string;
  pinned_by: string;
  pinned_at: string;
  is_active: boolean;
  unpinned_at: string | null;
  unpinned_by: string | null;
  pinner_name?: string;
  unpinner_name?: string;
  contact_name?: string;
}

export function usePinnedNotes(storeId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ['pinned-notes', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await (supabase
        .from('pinned_notes') as any)
        .select(`
          *,
          pinner:pinned_by(name),
          unpinner:unpinned_by(name),
          contact:contact_id(name)
        `)
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('pinned_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((n: any) => ({
        id: n.id,
        store_id: n.store_id,
        contact_id: n.contact_id,
        note_text: n.note_text,
        pinned_by: n.pinned_by,
        pinned_at: n.pinned_at,
        is_active: n.is_active,
        unpinned_at: n.unpinned_at,
        unpinned_by: n.unpinned_by,
        pinner_name: n.pinner?.name || 'Unknown',
        unpinner_name: n.unpinner?.name || null,
        contact_name: n.contact?.name || null,
      })) as PinnedNote[];
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });

  const pinMutation = useMutation({
    mutationFn: async ({ noteText, contactId }: { noteText: string; contactId?: string }) => {
      if (!storeId) throw new Error('Store ID required');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('pinned_notes')
        .insert({
          store_id: storeId,
          contact_id: contactId || null,
          note_text: noteText,
          pinned_by: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-notes', storeId] });
      queryClient.invalidateQueries({ queryKey: ['delivery-memory-snapshot', storeId] });
      toast.success('Note pinned');
    },
    onError: (err: Error) => toast.error(`Failed to pin note: ${err.message}`),
  });

  const unpinMutation = useMutation({
    mutationFn: async ({ noteId }: { noteId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('pinned_notes')
        .update({
          is_active: false,
          unpinned_at: new Date().toISOString(),
          unpinned_by: user.id,
        } as any)
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-notes', storeId] });
      queryClient.invalidateQueries({ queryKey: ['delivery-memory-snapshot', storeId] });
      toast.success('Note unpinned');
    },
    onError: (err: Error) => toast.error(`Failed to unpin note: ${err.message}`),
  });

  return {
    pinnedNotes: notes,
    isLoading,
    error,
    pinNote: pinMutation.mutateAsync,
    unpinNote: unpinMutation.mutateAsync,
    isPinning: pinMutation.isPending,
    isUnpinning: unpinMutation.isPending,
  };
}
