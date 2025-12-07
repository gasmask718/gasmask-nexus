import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StoreStatusEvent {
  id: string;
  store_id: string;
  event_type: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

export function useStoreStatusHistory(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-status-history", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("store_status_history")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StoreStatusEvent[];
    },
    enabled: !!storeId,
  });
}

export function useAddStoreStatusEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storeId,
      eventType,
      description,
    }: {
      storeId: string;
      eventType: string;
      description?: string;
    }) => {
      const { data, error } = await supabase
        .from("store_status_history")
        .insert({
          store_id: storeId,
          event_type: eventType,
          description: description || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["store-status-history", variables.storeId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to log event: ${error.message}`);
    },
  });
}
