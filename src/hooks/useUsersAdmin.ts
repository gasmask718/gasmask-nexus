import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  preferred_language: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  // from user_roles
  system_roles: { id: string; role: string; role_name: string | null }[];
}

export function useUsersAdmin() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, name, email, phone, role, preferred_language, avatar_url, created_at, updated_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("id, user_id, role, role_name"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const rolesMap = new Map<string, { id: string; role: string; role_name: string | null }[]>();
      for (const r of rolesRes.data || []) {
        const arr = rolesMap.get(r.user_id) || [];
        arr.push({ id: r.id, role: r.role as string, role_name: r.role_name });
        rolesMap.set(r.user_id, arr);
      }

      return (profilesRes.data || []).map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: p.role as string,
        preferred_language: p.preferred_language,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        updated_at: p.updated_at,
        system_roles: rolesMap.get(p.id) || [],
      })) as UserRow[];
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, email, phone, role }: { id: string; name?: string; email?: string; phone?: string; role?: string }) => {
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role as any;
      const { error } = await supabase.from("profiles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
