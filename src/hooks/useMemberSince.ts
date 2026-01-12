import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MemberSinceData {
  date: string | null;
  isManual: boolean;
  source: 'manual' | 'note' | 'created';
}

/**
 * Hook to get and manage the "Member Since" date for a store.
 * 
 * Priority:
 * 1. Manual override (store.member_since)
 * 2. Oldest note date
 * 3. Store created_at date
 */
export function useMemberSince(storeId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['member-since', storeId],
    queryFn: async (): Promise<MemberSinceData> => {
      if (!storeId) {
        return { date: null, isManual: false, source: 'created' };
      }

      // Get store with member_since and created_at
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('member_since, created_at')
        .eq('id', storeId)
        .single();

      if (storeError) throw storeError;

      // If there's a manual override, use it
      if (store?.member_since) {
        return {
          date: store.member_since,
          isManual: true,
          source: 'manual',
        };
      }

      // Otherwise, get the oldest note
      const { data: oldestNote, error: noteError } = await supabase
        .from('store_notes')
        .select('created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (noteError) throw noteError;

      if (oldestNote?.created_at) {
        return {
          date: oldestNote.created_at.split('T')[0], // Just the date part
          isManual: false,
          source: 'note',
        };
      }

      // Fallback to store created_at
      return {
        date: store?.created_at?.split('T')[0] || null,
        isManual: false,
        source: 'created',
      };
    },
    enabled: !!storeId,
  });

  const updateMemberSince = useMutation({
    mutationFn: async (date: string | null) => {
      if (!storeId) throw new Error('No store ID');

      const { error } = await supabase
        .from('stores')
        .update({ member_since: date })
        .eq('id', storeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-since', storeId] });
      toast.success('Member since date updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const clearManualOverride = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error('No store ID');

      const { error } = await supabase
        .from('stores')
        .update({ member_since: null })
        .eq('id', storeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-since', storeId] });
      toast.success('Reverted to auto-calculated date');
    },
    onError: (error: Error) => {
      toast.error(`Failed to clear: ${error.message}`);
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    updateMemberSince: updateMemberSince.mutateAsync,
    clearManualOverride: clearManualOverride.mutateAsync,
    isUpdating: updateMemberSince.isPending || clearManualOverride.isPending,
  };
}
