import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendSms } from "../_shared/sendSms.ts";

// UT-facing ambassador lifecycle notifications (approval / conversion /
// milestone / payout / tier_upgrade). All are person-triggered financial or
// status notices → transactional class. Sent via the send-sms chokepoint
// (suppression + legal-STOP, idempotency, outbound_messages).
// Sender parity preserved: same TWILIO_FROM_NUMBER this function always used.

type NotifyEvent = "approval" | "conversion" | "milestone" | "payout_paid" | "tier_upgrade";

interface NotifyRequest {
  ambassador_id?: string;
  phone?: string;
  event: NotifyEvent;
  referral_code?: string;
  commission_amount?: number;
  revenue_amount?: number;
  payout_amount?: number;
  new_tier?: string;
  milestone?: string;
}

function buildMessage(event: NotifyEvent, data: NotifyRequest & { ambassador?: Record<string, unknown> }): string {
  const name = (data.ambassador?.name as string) || "there";
  switch (event) {
    case "approval":
      return `🎉 Welcome to Unforgettable Times, ${name}! Your ambassador application is approved. Your referral link: unforgettable-times-usa.myshopify.com?ref=${data.referral_code} — Start sharing and earning today!`;
    case "conversion":
      return `💰 Cha-ching, ${name}! Your referral just converted — $${data.revenue_amount?.toFixed(2) ?? "0.00"} sale, you earned $${data.commission_amount?.toFixed(2) ?? "0.00"}. Keep sharing!`;
    case "milestone":
      return `🏆 Milestone unlocked, ${name}! ${data.milestone ?? "You hit a new goal"}. Your consistency is paying off — details in your dashboard.`;
    case "payout_paid":
      return `✅ Payout sent, ${name}! $${data.payout_amount?.toFixed(2) ?? "0.00"} is on its way to your account. Thanks for repping Unforgettable Times.`;
    case "tier_upgrade":
      return `⬆️ Tier up, ${name}! You're now ${(data.new_tier ?? "a higher tier").toUpperCase()} — higher commissions unlocked. Check your dashboard for details.`;
    default:
      return `Hi ${name}, you have a new update from Unforgettable Times. Check your ambassador dashboard.`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: NotifyRequest = await req.json();

    if (!body.event || (!body.ambassador_id && !body.phone)) {
      return new Response(JSON.stringify({ error: "event and ambassador_id (or phone) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve phone: direct or via ambassador record
    let phone = body.phone;
    let ambassadorData: Record<string, unknown> | undefined;

    if (!phone && body.ambassador_id) {
      const { data, error } = await supabase
        .from("unforgettable_ambassadors")
        .select("id, name, phone, referral_code, tier")
        .eq("id", body.ambassador_id)
        .single();

      if (error || !data?.phone) {
        console.error("Ambassador lookup failed:", error);
        return new Response(JSON.stringify({ error: "Ambassador not found or has no phone" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      phone = data.phone;
      ambassadorData = data;
      body.referral_code = body.referral_code || data.referral_code;
    }

    if (!phone) {
      return new Response(JSON.stringify({ error: "No phone number available" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = buildMessage(body.event, { ...body, ambassador: ambassadorData });

    // Idempotency: event + ambassador + amount. Distinct conversions/payouts
    // legitimately repeat, so the amount is part of the key; an identical
    // retried payload collapses to one send.
    const amountKey = body.commission_amount ?? body.payout_amount ?? body.revenue_amount ?? 0;
    const sms = await sendSms({
      to: phone,
      body: message,
      from: Deno.env.get("TWILIO_FROM_NUMBER"),
      idempotencyKey: `amb-notify-${body.event}-${body.ambassador_id ?? phone}-${amountKey}`,
      sendClass: "transactional",
      skipCooldown: true,
      purpose: `ambassador_${body.event}`,
      metadata: { event: body.event, ambassador_id: body.ambassador_id },
    });

    if (!sms.success) {
      if (sms.status === "blocked") {
        console.log(`ambassador-notify suppressed: event=${body.event} phone=${phone} reason=${sms.errorMessage}`);
        return new Response(JSON.stringify({ success: false, blocked: true, reason: sms.errorMessage, event: body.event }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("SMS via send-sms failed:", sms.status, sms.errorMessage);
      return new Response(JSON.stringify({ error: "SMS failed", details: sms.errorMessage }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`SMS sent: event=${body.event} phone=${phone} sid=${sms.providerMessageId}`);

    return new Response(JSON.stringify({ success: true, sid: sms.providerMessageId, event: body.event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ambassador-notify error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
