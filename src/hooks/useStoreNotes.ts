import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { verifiedUpdate, mutationErrorMessage } from "@/lib/verifiedMutation";

export interface StoreNote {
  id: string;
  store_id: string;
  note_text: string;
  created_at: string;
  created_by: string | null;
}

export function useStoreNotes(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-notes", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("store_notes")
        .select("*")
        .eq("store_id", storeId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StoreNote[];
    },
    enabled: !!storeId,
  });
}

export function useAddStoreNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storeId, noteText }: { storeId: string; noteText: string }) => {
      const { data, error } = await supabase
        .from("store_notes")
        .insert({ store_id: storeId, note_text: noteText })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["store-notes", variables.storeId] });
      toast.success("Note added");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });
}

export function useDeleteStoreNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, storeId }: { noteId: string; storeId: string }) => {
      // Soft delete — the row is retained for audit, only hidden from readers.
      await verifiedUpdate("Delete note", () =>
        supabase
          .from("store_notes")
          .update({ deleted_at: new Date().toISOString() } as never)
          .eq("id", noteId)
          .is("deleted_at", null)
          .select("id") as never,
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["store-notes", variables.storeId] });
      toast.success("Note deleted");
    },
    onError: (error: Error) => {
      toast.error(mutationErrorMessage(error));
    },
  });
}
