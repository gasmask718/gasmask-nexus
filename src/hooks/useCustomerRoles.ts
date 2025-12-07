import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CustomerRole {
  id: string;
  role_name: string;
  created_at: string;
}

export function useCustomerRoles() {
  return useQuery({
    queryKey: ["customer-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_roles")
        .select("*")
        .order("role_name");
      if (error) throw error;
      return data as CustomerRole[];
    },
  });
}

export function useAddCustomerRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleName: string) => {
      const { data, error } = await supabase
        .from("customer_roles")
        .insert({ role_name: roleName })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-roles"] });
      toast.success("Role added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add role");
    },
  });
}
