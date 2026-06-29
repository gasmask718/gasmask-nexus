import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface BuilderAssignControlProps {
  /** Row id in either brandaro_clients or brandaro_projects. */
  rowId: string;
  rowLabel: string;
  table: "brandaro_clients" | "brandaro_projects";
  currentAssignedBuilder: string | null | undefined;
  onChanged?: () => void;
}

/**
 * Per-client (or per-project) builder assignment.
 * Writes brandaro_clients.assigned_builder / brandaro_projects.assigned_builder.
 * Builder roster = user_roles WHERE role='developer'.
 */
export function BuilderAssignControl({
  rowId,
  rowLabel,
  table,
  currentAssignedBuilder,
  onChanged,
}: BuilderAssignControlProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: builders, isLoading } = useQuery({
    queryKey: ["brandaro-developer-roster"],
    queryFn: async () => {
      const sb: any = supabase as any;
      const { data: rolesRows, error: rolesErr } = await sb
        .from("user_roles")
        .select("user_id")
        .eq("role", "developer");
      if (rolesErr) throw rolesErr;
      const userIds = Array.from(new Set(((rolesRows || []) as any[]).map((r) => r.user_id))).filter(Boolean);
      if (userIds.length === 0) return [] as { user_id: string; name: string }[];
      const { data: profiles, error: profErr } = await sb
        .from("user_profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (profErr) throw profErr;
      const profileMap = new Map<string, string>();
      ((profiles || []) as any[]).forEach((p) => profileMap.set(p.user_id, p.full_name || ""));
      return userIds
        .map((uid) => ({ user_id: uid, name: profileMap.get(uid) || uid.slice(0, 8) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleChange = async (next: string) => {
    const target = next === "__clear__" ? null : next;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from(table)
        .update({ assigned_builder: target })
        .eq("id", rowId);
      if (error) throw error;
      toast.success(
        target
          ? `${rowLabel} → ${builders?.find((b) => b.user_id === target)?.name || "Builder"}`
          : `${rowLabel} builder cleared`
      );
      queryClient.invalidateQueries({ queryKey: ["brandaro-clients"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-projects"] });
      onChanged?.();
    } catch (err: any) {
      toast.error(`Builder assign failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select
      value={currentAssignedBuilder || "__clear__"}
      onValueChange={handleChange}
      disabled={saving || isLoading}
    >
      <SelectTrigger className="h-8 text-xs w-[170px]" onClick={(e) => e.stopPropagation()}>
        {saving ? (
          <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>
        ) : (
          <SelectValue placeholder="Unassigned" />
        )}
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        <SelectItem value="__clear__">— Unassigned —</SelectItem>
        {(builders || []).map((b) => (
          <SelectItem key={b.user_id} value={b.user_id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
