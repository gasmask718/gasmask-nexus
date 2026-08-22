// Dynasty Direct — process a partner payout via Stripe Connect transfer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { sendSms } from "../_shared/sendSms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev";

async function notifyPartner(
  partner: { phone?: string | null; email: string; full_name: string },
  amount: number,
  period: string,
  payoutId: string,
) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  // SMS via send-sms: transactional payout notice. Legal STOP is absolute —
  // if the partner STOPped, the money still moved; the notice is blocked and
  // the blocked row lands in outbound_messages + admin_notifications_log.
  try {
    if (partner.phone) {
      const res = await sendSms({
        to: partner.phone,
        from: Deno.env.get("TWILIO_FROM_NUMBER") ?? Deno.env.get("TWILIO_PHONE_NUMBER"),
        body: `Dynasty Direct: $${amount.toFixed(2)} sent for ${period}. View: https://dynastydirect.com/partner/payouts`,
        sendClass: "transactional",
        idempotencyKey: `dd-payout-sms-${payoutId}`,
        skipCooldown: true, // one payout = one notice
        purpose: "dd_payout_notice",
        metadata: { payout_id: payoutId, amount, period },
      });
      if (res.blocked) {
        console.warn(`[dd-pay-partner] payout SMS SUPPRESSED for partner (payout ${payoutId}): ${res.errorMessage}`);
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase.from("admin_notifications_log").insert({
          event_type: "sms:transactional:dd-pay-partner",
          channel: "sms",
          recipient: partner.phone,
          body: `Payout notice SUPPRESSED for payout ${payoutId} ($${amount.toFixed(2)}, ${period}) — ${res.errorMessage}. Money moved; partner not texted. Email fallback still sent.`,
          status: "blocked",
          metadata: { payout_id: payoutId, amount, period, reason: res.errorMessage },
        });
      } else if (!res.success) {
        console.error(`[dd-pay-partner] payout SMS failed: ${res.status} ${res.errorMessage}`);
      }
    }
  } catch (_) { /* non-fatal */ }
  // Email via Resend gateway
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (lovableKey && resendKey) {
      await fetch(`${GATEWAY}/resend/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({
          from: "Dynasty Direct <payouts@dynastydirect.com>",
          to: [partner.email],
          subject: `Payout sent: $${amount.toFixed(2)}`,
          html: `<h2>Hi ${partner.full_name},</h2>
            <p>Your Dynasty Direct partner payout of <strong>$${amount.toFixed(2)}</strong> for ${period} has been sent to your connected bank account.</p>
            <p><a href="https://dynastydirect.com/partner/payouts">View payout details</a></p>`,
        }),
      });
    }
  } catch (_) { /* non-fatal */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { payout_id, amount, partner_id } = await req.json();
    if (!payout_id || !amount || !partner_id) throw new Error("payout_id, amount, partner_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    const { data: partner, error: pe } = await supabase
      .from("dd_partner_profiles").select("*").eq("id", partner_id).maybeSingle();
    if (pe || !partner) throw new Error("partner not found");
    if (!partner.stripe_connect_account_id || !partner.stripe_connect_onboarded) {
      throw new Error("partner not onboarded to Stripe Connect");
    }

    const { data: payout, error: pye } = await supabase
      .from("dd_partner_payouts").select("*").eq("id", payout_id).maybeSingle();
    if (pye || !payout) throw new Error("payout not found");
    if (payout.status === "paid") throw new Error("already paid");

    // Claim the payout BEFORE money moves. This is the only lock against a
    // double transfer, so a failed claim must abort — it used to be unread.
    const { data: claimed, error: claimErr } = await supabase
      .from("dd_partner_payouts")
      .update({ status: "processing" })
      .eq("id", payout_id)
      .neq("status", "paid")
      .select("id");
    if (claimErr) throw new Error(`payout claim failed: ${claimErr.message}`);
    if (!claimed || claimed.length === 0) {
      throw new Error("payout could not be claimed (already paid or not visible)");
    }

    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(Number(amount) * 100),
        currency: "usd",
        destination: partner.stripe_connect_account_id,
        transfer_group: payout_id,
        metadata: { dd_payout_id: payout_id, dd_partner_id: partner_id },
      },
      // A retry of this request must not create a second transfer.
      { idempotencyKey: `dd-payout-${payout_id}` },
    );

    // ── money has moved ────────────────────────────────────────────────────
    // Everything below is bookkeeping. It must never throw: a 4xx/5xx here
    // invites the caller to retry, and a retry re-pays the partner. Failures
    // are logged loudly and reported in the response body instead.
    let bookkeepingError: string | null = null;

    const { error: paidErr } = await supabase.from("dd_partner_payouts").update({
      status: "paid",
      stripe_transfer_id: transfer.id,
      paid_at: new Date().toISOString(),
    }).eq("id", payout_id);
    if (paidErr) {
      bookkeepingError = `payout row not marked paid: ${paidErr.message}`;
      console.error(`[dd-pay-partner] MONEY SENT (${transfer.id}) but ${bookkeepingError}`);
    }

    const { error: balErr } = await supabase.from("dd_partner_profiles").update({
      total_paid_lifetime: Number(partner.total_paid_lifetime ?? 0) + Number(amount),
      pending_balance: Math.max(Number(partner.pending_balance ?? 0) - Number(amount), 0),
    }).eq("id", partner_id);
    if (balErr) {
      bookkeepingError = `${bookkeepingError ? bookkeepingError + "; " : ""}partner balance not updated: ${balErr.message}`;
      console.error(`[dd-pay-partner] MONEY SENT (${transfer.id}) but balance write failed:`, balErr.message);
    }

    const period = `${payout.period_start} → ${payout.period_end}`;
    try {
      await notifyPartner(partner, Number(amount), period);
    } catch (notifyErr) {
      console.error("[dd-pay-partner] partner notification failed:", String(notifyErr));
    }

    return new Response(
      JSON.stringify({ ok: true, transfer_id: transfer.id, bookkeeping_error: bookkeepingError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
