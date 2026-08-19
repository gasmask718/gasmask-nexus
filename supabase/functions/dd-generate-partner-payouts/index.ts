// Dynasty Direct — Monthly partner payout generator.
// Runs on the last day of each month (via pg_cron) or invoked manually.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTwilioSms } from "../_shared/twilioSend.ts";
import { sendOpsAlert } from "../_shared/opsAlert.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Partner-facing earnings notices are Group D (workforce: a contracted
// relationship, marketing-DNC exempt, legal STOP absolute). The owner summary
// at the end is Group A and goes to the ops channel instead.
async function sendPartnerSms(to: string | null | undefined, body: string) {
  if (!to) return;
  await sendTwilioSms({
    to,
    body,
    suppressionClass: "workforce",
    source: "dd-generate-partner-payouts",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { month, year, partner_id, force } = payload as {
      month?: number; year?: number; partner_id?: string; force?: boolean;
    };

    // Determine period
    const now = new Date();
    let m: number, y: number;
    if (month && year) {
      m = month; y = year;
    } else {
      // default = previous month
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      m = prev.getMonth() + 1; y = prev.getFullYear();
    }

    // Last-day guard ONLY when running auto for previous month with no explicit dates
    if (!month && !year && !force) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isLastDay = tomorrow.getMonth() !== now.getMonth();
      if (!isLastDay) {
        return new Response(JSON.stringify({ skipped: true, reason: "Not last day of month" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // When cron triggers on last day, generate for THE CURRENT month
      m = now.getMonth() + 1;
      y = now.getFullYear();
    }

    const periodStart = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
    const periodEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const periodLabel = `${MONTH_NAMES[m - 1]} ${y}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase
      .from("dd_partner_profiles")
      .select("id, user_id, full_name, email, phone, stripe_connect_onboarded, pending_balance")
      .eq("status", "active");
    if (partner_id) q = q.eq("id", partner_id);
    const { data: partners, error: pErr } = await q;
    if (pErr) throw pErr;

    let payoutsCreated = 0;
    let totalAmount = 0;
    const processed: Array<{ partner_id: string; amount: number }> = [];

    for (const partner of partners ?? []) {
      // Idempotency
      const { data: existing } = await supabase
        .from("dd_partner_payouts")
        .select("id")
        .eq("partner_id", partner.id)
        .eq("period_start", periodStart)
        .maybeSingle();
      if (existing) continue;

      const { data: earningsData, error: eErr } = await supabase.rpc(
        "dd_calculate_partner_monthly_earnings",
        { p_partner_id: partner.id, p_period_start: periodStart, p_period_end: periodEnd },
      );
      if (eErr) { console.error("earnings rpc failed", partner.id, eErr); continue; }
      const e = (earningsData ?? {}) as Record<string, number>;
      const total = Number(e.total_earnings ?? 0);
      if (total <= 0) continue;

      const { error: insErr } = await supabase.from("dd_partner_payouts").insert({
        partner_id: partner.id,
        period_start: periodStart,
        period_end: periodEnd,
        wholesaler_referral_earnings: Number(e.referral_earnings ?? 0),
        campaign_earnings: Number(e.campaign_earnings ?? 0),
        total_revenue: Number(e.campaign_revenue ?? 0),
        total_costs: Number(e.campaign_costs ?? 0),
        net_profit: Number(e.campaign_profit ?? 0),
        partner_earnings: total,
        status: "pending_review",
      });
      if (insErr) { console.error("insert payout failed", partner.id, insErr); continue; }

      // Increment pending balance
      const newPending = Number(partner.pending_balance ?? 0) + total;
      await supabase.from("dd_partner_profiles")
        .update({ pending_balance: newPending })
        .eq("id", partner.id);

      payoutsCreated++;
      totalAmount += total;
      processed.push({ partner_id: partner.id, amount: total });

      // SMS partner
      await sendPartnerSms(
        partner.phone,
        `📊 Your Dynasty Direct earnings for ${periodLabel} are ready!\n` +
        `Referral: $${Number(e.referral_earnings ?? 0).toFixed(2)}\n` +
        `Campaign: $${Number(e.campaign_earnings ?? 0).toFixed(2)}\n` +
        `Total: $${total.toFixed(2)}\n` +
        `Review: dynastydirect.com/partner/payouts\n` +
        `David will approve within 2-3 business days.`,
      );
    }

    // Owner summary → Group A ops channel (email-first).
    if (payoutsCreated > 0) {
      await sendOpsAlert({
        source: "dd-generate-partner-payouts",
        severity: "info",
        subject: "Monthly partner payouts generated",
        message: `Partners: ${payoutsCreated}\nTotal owed: $${totalAmount.toFixed(2)}\nReview: /dynasty-direct/partners`,
        context: { payouts_created: payoutsCreated, total_amount: totalAmount },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        partners_processed: partners?.length ?? 0,
        payouts_created: payoutsCreated,
        total_amount: totalAmount,
        period: `${periodStart} to ${periodEnd}`,
        processed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("dd-generate-partner-payouts error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
