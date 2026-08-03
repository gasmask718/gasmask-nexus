// Shared writer for the Brandaro cash ledger (brandaro_revenue_tracking).
//
// brandaro_revenue_tracking is the ONLY source the Revenue Analytics page
// (/brandaro/revenue) reads. Before this helper existed, nothing in the paid
// pipeline wrote to it — money moved through Stripe into brandaro_clients /
// brandaro_subscriptions and the page stayed at $0 forever.
//
// Rules:
//   * ledger = CASH COLLECTED. One row per real Stripe charge.
//   * MRR is NOT derived from this table (it is a run-rate read from
//     brandaro_subscriptions). Never treat sum(recurring rows) as MRR.
//   * every row carries stripe_reference (session id / invoice id / sub id),
//     which has a unique partial index — retries can never double-count.
//   * never throws: callers run inside best-effort webhook paths.

// deno-lint-ignore no-explicit-any
type Supa = any;

export type RevenueSource =
  | "stripe_checkout"
  | "stripe_invoice"
  | "hosting_start"
  | "manual";

export interface RecordRevenueInput {
  /** Dollars, not cents. */
  amount: number;
  /** e.g. website_starter, website_pro, hosting_monthly, receptionist_monthly */
  revenue_type: string;
  /** Stripe object id that caused this row. Required for idempotency. */
  stripe_reference: string;
  source: RevenueSource;
  client_id?: string | null;
  subscription_id?: string | null;
  lead_id?: string | null;
  /** Shown in the Description column. */
  description?: string | null;
  /** Shown in the Source column. */
  industry?: string | null;
  occurred_at?: string | null;
}

export interface RecordRevenueResult {
  recorded: boolean;
  duplicate: boolean;
  id?: string | null;
  error?: string;
}

export async function recordRevenue(
  supabase: Supa,
  input: RecordRevenueInput,
): Promise<RecordRevenueResult> {
  const amount = Number(input.amount);
  if (!input.stripe_reference) {
    return { recorded: false, duplicate: false, error: "stripe_reference required" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    console.log(
      `[brandaroRevenue] skipping non-positive amount for ${input.stripe_reference}`,
    );
    return { recorded: false, duplicate: false };
  }

  try {
    // Explicit pre-check keeps the log readable; the unique index is the real guard.
    const { data: existing } = await supabase
      .from("brandaro_revenue_tracking")
      .select("id")
      .eq("stripe_reference", input.stripe_reference)
      .maybeSingle();
    if (existing?.id) {
      console.log(`[brandaroRevenue] duplicate ignored: ${input.stripe_reference}`);
      return { recorded: false, duplicate: true, id: existing.id };
    }

    const row: Record<string, unknown> = {
      revenue_amount: amount,
      revenue_type: input.revenue_type,
      stripe_reference: input.stripe_reference,
      source: input.source,
      client_id: input.client_id ?? null,
      subscription_id: input.subscription_id ?? null,
      lead_id: input.lead_id ?? null,
      attributed_campaign: input.description ?? null,
      attributed_industry: input.industry ?? null,
    };
    if (input.occurred_at) row.created_at = input.occurred_at;

    const { data, error } = await supabase
      .from("brandaro_revenue_tracking")
      .insert(row)
      .select("id")
      .maybeSingle();

    if (error) {
      // 23505 = raced against another delivery of the same event.
      if ((error as { code?: string }).code === "23505") {
        return { recorded: false, duplicate: true };
      }
      console.error("[brandaroRevenue] insert failed:", error.message);
      return { recorded: false, duplicate: false, error: error.message };
    }

    console.log(
      `[brandaroRevenue] +$${amount} ${input.revenue_type} (${input.source}) ref=${input.stripe_reference}`,
    );
    return { recorded: true, duplicate: false, id: data?.id ?? null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[brandaroRevenue] threw:", message);
    return { recorded: false, duplicate: false, error: message };
  }
}

/** Maps a package tier to a ledger revenue_type for one-time build payments. */
export function buildRevenueType(tier: string | null | undefined): string {
  const t = (tier || "").toLowerCase();
  if (t === "starter" || t === "pro" || t === "custom") return `website_${t}`;
  return "website_build";
}
