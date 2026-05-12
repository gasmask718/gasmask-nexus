// Dynasty Partners — typed-ish helper for the `partners` schema
// Requires `partners` to be added to Supabase Settings → API → Exposed schemas.
import { supabase } from "@/integrations/supabase/client";

// Untyped per-call schema override (the generated Database types only cover `public`).
export const dp = () => (supabase as any).schema("partners");

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

export async function logAdminAction(opts: {
  action: string;
  entity_type?: string;
  entity_id?: string;
  partner_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data: u } = await supabase.auth.getUser();
  await dp()
    .from("activity_log")
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
