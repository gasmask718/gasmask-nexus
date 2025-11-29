import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CrudOptions {
  table: string;
  queryKey: string[];
  successMessages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
}

export function useCrudOperations({
  table,
  queryKey,
  successMessages = {},
}: CrudOptions) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { data: result, error } = await (supabase as any)
        .from(table)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(successMessages.create || "Item created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const { data: result, error } = await (supabase as any)
        .from(table)
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(successMessages.update || "Item updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(successMessages.delete || "Item deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(successMessages.delete || "Item archived successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive: ${error.message}`);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean | string }) => {
      const { error } = await (supabase as any)
        .from(table)
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Status updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    softDelete: softDeleteMutation.mutateAsync,
    toggleStatus: toggleStatusMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
