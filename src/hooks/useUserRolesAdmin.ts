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
      // Fetch roles and profiles separately (no FK relationship exists)
      const [rolesRes, profilesRes] = await Promise.all([
        supabase.from("user_roles").select("id, user_id, role, role_name, created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, name, email, phone"),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const profileMap = new Map<string, { name: string | null; email: string | null; phone: string | null }>();
      for (const p of profilesRes.data || []) {
        profileMap.set(p.id, { name: p.name, email: p.email, phone: p.phone });
      }

      return (rolesRes.data || []).map((row: any) => {
        const profile = profileMap.get(row.user_id);
        return {
          id: row.id,
          user_id: row.user_id,
          role: row.role as string,
          role_name: row.role_name,
          created_at: row.created_at,
          name: profile?.name || null,
          email: profile?.email || null,
          phone: profile?.phone || null,
        };
      }) as UserRoleRow[];
    },
  });
}

async function bridgeAmbassadorIfNeeded(role: string, user_id: string) {
  if (role !== "ambassador") return;
  const { error } = await (supabase as any).rpc("bridge_ambassador_role_to_ut", { _user_id: user_id });
  if (error) {
    console.warn("[bridge_ambassador_role_to_ut] failed", error);
    toast.warning("Role assigned, but UT ambassador activation failed: " + error.message);
  }
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, role_name }: { id: string; role: string; role_name?: string }) => {
      const { data, error } = await supabase
        .from("user_roles")
        .update({ role: role as any, role_name: role_name ?? null })
        .eq("id", id)
        .select("user_id, role")
        .single();
      if (error) throw error;
      await bridgeAmbassadorIfNeeded(role, data.user_id);
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user-roles"] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Role deleted"); },
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
      await bridgeAmbassadorIfNeeded(role, user_id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user-roles"] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Role assigned"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

