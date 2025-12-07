import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Borough {
  id: string;
  name: string;
  created_at: string;
}

export function useBoroughs() {
  return useQuery({
    queryKey: ["boroughs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boroughs")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Borough[];
    },
  });
}

export function useAddBorough() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("boroughs")
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boroughs"] });
      toast.success("Borough added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add borough");
    },
  });
}
