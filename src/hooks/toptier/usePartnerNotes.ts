import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PartnerNote {
  id: string;
  partner_id: string;
  business_slug: string;
  is_simulation: boolean;
  note_text: string;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined profile data
  creator_name?: string;
}

export function usePartnerNotes(partnerId: string | undefined, isSimulation: boolean) {
  const queryClient = useQueryClient();

  // Fetch notes with creator profile
  const { data: notes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['partner-notes', partnerId, isSimulation],
    queryFn: async () => {
      if (!partnerId) return [];

      const { data, error } = await supabase
        .from('crm_partner_notes')
        .select(`
          *,
          profiles:created_by (name)
        `)
        .eq('partner_id', partnerId)
        .eq('is_simulation', isSimulation)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Flatten profile data
      return (data || []).map((note: any) => ({
        ...note,
        creator_name: note.profiles?.name || 'Unknown',
        profiles: undefined,
      })) as PartnerNote[];
    },
    enabled: !!partnerId,
  });

  // Add note
  const addMutation = useMutation({
    mutationFn: async ({ noteText }: { noteText: string }) => {
      if (!partnerId) throw new Error('Partner ID required');

      const { data, error } = await supabase
        .from('crm_partner_notes')
        .insert({
          partner_id: partnerId,
          business_slug: 'toptier-experience',
          is_simulation: isSimulation,
          note_text: noteText,
          is_pinned: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-notes', partnerId] });
      toast.success('Note saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save note: ${err.message}`);
    },
  });

  // Update note text
  const updateMutation = useMutation({
    mutationFn: async ({ noteId, noteText }: { noteId: string; noteText: string }) => {
      const { data, error } = await supabase
        .from('crm_partner_notes')
        .update({ note_text: noteText })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-notes', partnerId] });
      toast.success('Note updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update note: ${err.message}`);
    },
  });

  // Toggle pin
  const togglePinMutation = useMutation({
    mutationFn: async ({ noteId, isPinned }: { noteId: string; isPinned: boolean }) => {
      const { data, error } = await supabase
        .from('crm_partner_notes')
        .update({ is_pinned: isPinned })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-notes', partnerId] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to update pin: ${err.message}`);
    },
  });

  // Delete note
  const deleteMutation = useMutation({
    mutationFn: async ({ noteId }: { noteId: string }) => {
      const { error } = await supabase
        .from('crm_partner_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-notes', partnerId] });
      toast.success('Note deleted');
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete note: ${err.message}`);
    },
  });

  return {
    notes,
    isLoading,
    error,
    refetch,
    addNote: addMutation.mutateAsync,
    updateNote: updateMutation.mutateAsync,
    togglePin: togglePinMutation.mutateAsync,
    deleteNote: deleteMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
