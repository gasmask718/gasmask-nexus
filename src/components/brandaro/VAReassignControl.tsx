import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserCog, Loader2 } from "lucide-react";
import { useState } from "react";

interface VAReassignControlProps {
  leadId: string;
  leadName: string;
  currentAssignedVa: string | null | undefined;
  onChanged?: () => void;
}

/**
 * Per-lead VA reassignment.
 * Writes to brandaro_qualified_leads.assigned_va only.
 * Does NOT dual-write to brandaro_lead_assignments (dead table — see T5 Phase 0 audit).
 *
 * VA roster source: user_roles WHERE role='va' joined to user_profiles.
 */
export function VAReassignControl({
  leadId,
  leadName,
  currentAssignedVa,
  onChanged,
}: VAReassignControlProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: vas, isLoading } = useQuery({
    queryKey: ["brandaro-va-roster-for-assign"],
    queryFn: async () => {
      const sb: any = supabase as any;
      const { data: rolesRows, error: rolesErr } = await sb
        .from("user_roles")
        .select("user_id")
        .eq("role", "va");
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
    const target = next === "__unassign__" ? null : next;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("brandaro_qualified_leads")
        .update({ assigned_va: target, updated_at: new Date().toISOString() } as any)
        .eq("id", leadId);
      if (error) throw error;
      toast.success(
        target
          ? `Reassigned ${leadName} to ${vas?.find((v) => v.user_id === target)?.name || "VA"}`
          : `Unassigned ${leadName}`
      );
      queryClient.invalidateQueries({ queryKey: ["brandaro-leads-table"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-pm-dashboard"] });
      onChanged?.();
    } catch (err: any) {
      toast.error(`Reassign failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
        <UserCog className="h-3 w-3" /> VA Assignment
      </Label>
      <Select
        value={currentAssignedVa || "__unassign__"}
        onValueChange={handleChange}
        disabled={saving || isLoading}
      >
        <SelectTrigger className="h-9 text-sm">
          {saving ? (
            <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>
          ) : (
            <SelectValue placeholder="Select a VA…" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unassign__">— Unassigned —</SelectItem>
          {(vas || []).map((va) => (
            <SelectItem key={va.user_id} value={va.user_id}>
              {va.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
