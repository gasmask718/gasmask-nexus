import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: string;
  role_name: string | null;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

const APP_ROLES = [
  'admin', 'csr', 'driver', 'biker', 'ambassador', 'wholesaler', 'warehouse',
  'accountant', 'employee', 'store', 'wholesale', 'influencer', 'customer',
  'pod_worker', 'realestate_worker', 'owner', 'developer', 'staff', 'creator',
  'va', 'production'
] as const;

export type AppRole = typeof APP_ROLES[number];
export { APP_ROLES };

export function useUserRolesAdmin() {
  return useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, role_name, created_at, profiles(name, email, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        role: row.role as string,
        role_name: row.role_name,
        created_at: row.created_at,
        name: row.profiles?.name || null,
        email: row.profiles?.email || null,
        phone: row.profiles?.phone || null,
      })) as UserRoleRow[];
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, role_name }: { id: string; role: string; role_name?: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: role as any, role_name: role_name ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user-roles"] }); toast.success("Role updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user-roles"] }); toast.success("Role deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, role, role_name }: { user_id: string; role: string; role_name?: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id, role: role as any, role_name: role_name ?? null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user-roles"] }); toast.success("Role assigned"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
