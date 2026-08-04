import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Headphones, HeadphoneOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

const GASMASK_BUSINESS_ID = "c3d4e5f6-a7b8-9012-cdef-123456789012";

/**
 * On-shift toggle for GasMask VAs.
 *
 * Writes the VA's browser softphone identity into human_agent_line_status so
 * the inbound voice webhook can ring them with <Client> in parallel with the
 * owner's cell. Going off shift flips status to 'offline'.
 */
export function GasMaskShiftToggle() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [onShift, setOnShift] = useState(false);
  const [identity, setIdentity] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }
      const id = `user_${user.id.replace(/-/g, "")}`;
      setUserId(user.id);
      setIdentity(id);
      setDisplayName(
        (user.user_metadata?.full_name as string) || user.email || null,
      );
      const { data } = await supabase
        .from("human_agent_line_status")
        .select("status")
        .eq("business_id", GASMASK_BUSINESS_ID)
        .eq("client_identity", id)
        .maybeSingle();
      if (!cancelled) {
        setOnShift(data?.status === "available");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(async () => {
    if (!identity || !userId) return;
    setSaving(true);
    const next = !onShift;
    const payload = {
      business_id: GASMASK_BUSINESS_ID,
      client_identity: identity,
      user_id: userId,
      display_name: displayName,
      // Softphone rows have no dialable PSTN number; the sentinel keeps the
      // NOT NULL key satisfied and is filtered out of SMS alert fan-outs.
      phone_number: `client:${identity}`,
      status: next ? "available" : "offline",
      on_shift_since: next ? new Date().toISOString() : null,
    };
    const { data: existing } = await supabase
      .from("human_agent_line_status")
      .select("id")
      .eq("client_identity", identity)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("human_agent_line_status").update(payload).eq("id", existing.id)
      : await supabase.from("human_agent_line_status").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(`Could not update shift status: ${error.message}`);
      return;
    }
    setOnShift(next);
    toast.success(next ? "You're on shift — inbound calls will ring here" : "You're off shift");
  }, [identity, userId, displayName, onShift]);

  if (loading) return null;

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={saving}
      onClick={toggle}
      className={
        onShift
          ? "gap-1 text-emerald-400 hover:text-emerald-300"
          : "gap-1 text-slate-400 hover:text-slate-200"
      }
      title={onShift ? "Go off shift" : "Go on shift to receive inbound calls"}
    >
      {saving ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : onShift ? (
        <Headphones className="h-3 w-3" />
      ) : (
        <HeadphoneOff className="h-3 w-3" />
      )}
      <span className="hidden md:inline">{onShift ? "On Shift" : "Off Shift"}</span>
    </Button>
  );
}
