import { supabase } from "@/integrations/supabase/client";

// View name mapping — maps partners schema table names to public dp_* wrapper views
const VIEW_MAP: Record<string, string> = {
  partners: "dp_partners",
  platforms: "dp_platforms",
  ambassadors: "dp_ambassadors",
  campaigns: "dp_campaigns",
  sales: "dp_sales",
  commission_splits: "dp_commission_splits",
  payouts: "dp_payouts",
  leads: "dp_leads",
  activity_log: "dp_activity_log",
  notifications: "dp_notifications",
  mrr_subscriptions: "dp_mrr_subscriptions",
  partner_platforms: "dp_partner_platforms",
  tracking_links: "dp_tracking_links",
  outreach_messages: "dp_outreach_messages",
  ai_personas: "dp_ai_personas",
  add_ons: "dp_add_ons",
  partner_admins: "dp_partner_admins",
};

// Read-only adapter — maps old dp().from("table") calls to
// supabase.from("dp_table") via public wrapper views. SELECT only.
export const dp = () => ({
  from: (table: string) => {
    const viewName = VIEW_MAP[table];
    if (!viewName) {
      console.warn(`[dpClient] No view mapping for table: ${table}`);
    }
    return (supabase as any).from(viewName ?? `dp_${table}`);
  },
});

// Writes go through the public.dp_* wrapper views (auto-updatable simple
// views over partners.*). RLS on the base tables gates row visibility.
export const DP_READ_ONLY = false;


export const DP_READ_ONLY_MESSAGE =
  "Admin writes are temporarily disabled while the database schema configuration is being updated. Data is visible but cannot be modified. Contact david@dynastyconnect.com if urgent.";

// Utility functions
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
