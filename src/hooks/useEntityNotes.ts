import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EntityNote {
  id: string;
  entity_id: string;
  note_text: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

type EntityType = 'ambassador' | 'wholesaler' | 'driver';

export function useEntityNotes(entityType: EntityType, entityId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch notes with creator profile
  const { data: notes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['entity-notes', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];

      const tableName = entityType === 'ambassador' 
        ? 'ambassador_notes' 
        : entityType === 'wholesaler' 
          ? 'wholesaler_notes' 
          : 'driver_notes';
      const fkColumn = entityType === 'ambassador' 
        ? 'ambassador_id' 
        : entityType === 'wholesaler' 
          ? 'wholesaler_id' 
          : 'driver_id';

      const { data, error } = await supabase
        .from(tableName as 'ambassador_notes')
        .select(`
          *,
          profiles:created_by (name)
        `)
        .eq(fkColumn as 'ambassador_id', entityId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Flatten profile data
      return (data || []).map((note: any) => ({
        id: note.id,
        entity_id: note[fkColumn],
        note_text: note.note_text,
        is_pinned: note.is_pinned,
        created_by: note.created_by,
        created_at: note.created_at,
        updated_at: note.updated_at,
        creator_name: note.profiles?.name || 'Unknown',
      })) as EntityNote[];
    },
    enabled: !!entityId,
  });

  // Add note
  const addMutation = useMutation({
    mutationFn: async ({ noteText }: { noteText: string }) => {
      if (!entityId) throw new Error('Entity ID required');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const tableName = entityType === 'ambassador' 
        ? 'ambassador_notes' 
        : entityType === 'wholesaler' 
          ? 'wholesaler_notes' 
          : 'driver_notes';
      const fkColumn = entityType === 'ambassador' 
        ? 'ambassador_id' 
        : entityType === 'wholesaler' 
          ? 'wholesaler_id' 
          : 'driver_id';

      const insertData: Record<string, any> = {
        [fkColumn]: entityId,
        note_text: noteText,
        is_pinned: false,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from(tableName as 'ambassador_notes')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-notes', entityType, entityId] });
      toast.success('Note saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save note: ${err.message}`);
    },
  });

  // Update note text
  const updateMutation = useMutation({
    mutationFn: async ({ noteId, noteText }: { noteId: string; noteText: string }) => {
      const tableName = entityType === 'ambassador' 
        ? 'ambassador_notes' 
        : entityType === 'wholesaler' 
          ? 'wholesaler_notes' 
          : 'driver_notes';
      
      const { data, error } = await supabase
        .from(tableName as 'ambassador_notes')
        .update({ note_text: noteText } as any)
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-notes', entityType, entityId] });
      toast.success('Note updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update note: ${err.message}`);
    },
  });

  // Toggle pin
  const togglePinMutation = useMutation({
    mutationFn: async ({ noteId, isPinned }: { noteId: string; isPinned: boolean }) => {
      const tableName = entityType === 'ambassador' 
        ? 'ambassador_notes' 
        : entityType === 'wholesaler' 
          ? 'wholesaler_notes' 
          : 'driver_notes';
      
      const { data, error } = await supabase
        .from(tableName as 'ambassador_notes')
        .update({ is_pinned: isPinned } as any)
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-notes', entityType, entityId] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to update pin: ${err.message}`);
    },
  });

  // Delete note
  const deleteMutation = useMutation({
    mutationFn: async ({ noteId }: { noteId: string }) => {
      const tableName = entityType === 'ambassador' 
        ? 'ambassador_notes' 
        : entityType === 'wholesaler' 
          ? 'wholesaler_notes' 
          : 'driver_notes';
      
      const { error } = await supabase
        .from(tableName as 'ambassador_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-notes', entityType, entityId] });
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
