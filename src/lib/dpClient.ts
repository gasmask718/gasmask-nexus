import { supabase } from "@/integrations/supabase/client";

// Direct schema access — 'partners' is exposed via PostgREST.
export const dp = () => (supabase as any).schema("partners");

// Writes enabled.
export const DP_READ_ONLY = false;

export const DP_READ_ONLY_MESSAGE = "";

// Utility functions (unchanged)
export const fmtMoney = (cents: number | null | undefined) =>
  `$${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString() : "—";

export const monthStartISO = (offset = 0) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + offset, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

// logAdminAction — disabled in read-only mode, logs to console only.
export async function logAdminAction(opts: {
  action: string;
  entity_type?: string;
  entity_id?: string;
  partner_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (DP_READ_ONLY) {
    console.log("[dpAdmin] action logged (read-only mode):", opts.action);
    return;
  }
  // Full implementation when schema is exposed:
  const { data: u } = await supabase.auth.getUser();
  await (supabase as any)
    .from("dp_activity_log")
    .insert({
      actor_type: "admin",
      actor_id: u.user?.id ?? null,
      action: opts.action,
      entity_type: opts.entity_type ?? null,
      entity_id: opts.entity_id ?? null,
      partner_id: opts.partner_id ?? null,
      metadata: opts.metadata ?? {},
      visible_to_partner: false,
    });
}
