import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms as sendCanonicalSms } from "../_shared/sendSms.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * brandaro-create-payment-link
 * 
 * Creates a Stripe Checkout session for a pipeline deal and sends the
 * payment link to the lead via SMS. Updates the close pipeline record
 * with the link URL and timestamp.
 * 
 * INPUT: { deal_id, lead_id, package_tier?, custom_amount? }
 */

const PACKAGE_PRICES: Record<string, { amount: number; name: string }> = {
  starter: { amount: 75000, name: "Starter Website Package" },
  growth: { amount: 150000, name: "Growth Website Package" },
  premium: { amount: 300000, name: "Premium Website Package" },
  elite: { amount: 500000, name: "Elite Website Package" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    if (body.dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { deal_id, lead_id, package_tier, custom_amount, send_sms = true } = body;

    if (!deal_id && !lead_id) {
      return new Response(JSON.stringify({ error: "deal_id or lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the deal
    let deal: any;
    if (deal_id) {
      const { data, error } = await supabase
        .from("brandaro_close_pipeline")
        .select("*, brandaro_qualified_leads:lead_id(*)")
        .eq("id", deal_id)
        .single();
      if (error) throw error;
      deal = data;
    } else {
      const { data, error } = await supabase
        .from("brandaro_close_pipeline")
        .select("*, brandaro_qualified_leads:lead_id(*)")
        .eq("lead_id", lead_id)
        .single();
      if (error) throw error;
      deal = data;
    }

    if (!deal) throw new Error("Deal not found");

    const lead = deal.brandaro_qualified_leads;
    const businessName = lead?.business_name || "Your Business";

    // Determine amount
    const pkg = package_tier ? PACKAGE_PRICES[package_tier] : null;
    const amount = custom_amount || pkg?.amount || deal.payment_amount || 75000;
    const productName = pkg?.name || `Custom Website for ${businessName}`;

    // Idempotency: if link already exists and not expired, reuse it
    if (deal.payment_link_url && deal.payment_link_sent_at) {
      const sentAt = new Date(deal.payment_link_sent_at).getTime();
      const hoursSince = (Date.now() - sentAt) / 3600000;
      if (hoursSince < 24) {
        return new Response(JSON.stringify({
          success: true,
          checkout_url: deal.payment_link_url,
          reused: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create Stripe Checkout Session
    const frontendUrl = Deno.env.get("FRONTEND_BASE_URL") || "https://gasmask-os-nexus.lovable.app";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: productName,
            description: `Professional website for ${businessName}. Includes design, development, hosting setup, and 30-day support.`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      metadata: {
        lead_id: deal.lead_id,
        deal_id: deal.id,
        package_tier: package_tier || "custom",
        business_name: businessName,
      },
      success_url: `${frontendUrl}/os/brandaro/clients?payment=success&lead=${deal.lead_id}`,
      cancel_url: `${frontendUrl}/os/brandaro/revenue?payment=cancelled`,
      customer_email: lead?.email || undefined,
      expires_after: 86400, // 24 hours
    });

    const checkoutUrl = session.url!;

    // Update pipeline with payment link
    await supabase.from("brandaro_close_pipeline").update({
      payment_link_url: checkoutUrl,
      payment_link_sent_at: new Date().toISOString(),
      stage: deal.stage === "interested" ? "negotiating" : deal.stage,
      urgency_level: "critical",
    }).eq("id", deal.id);

    // Send SMS with payment link
    if (send_sms && lead?.phone) {
      const smsBody = `Hey ${businessName}! Your custom website is ready to go live. Here's the link to get started — we can have it live for you today:\n\n${checkoutUrl}`;

      // Group C (transactional): a payment link the lead asked us to send.
      // Destination is the lead's own number, captured on that lead record.
      const sent = await sendCanonicalSms({
        to: normalizePhone(lead.phone),
        body: smsBody,
        sendClass: "transactional",
        purpose: "brandaro_payment_link",
        idempotencyKey: `brandaro-paylink-${deal.id}-${session.id}`,
        skipCooldown: true,
        metadata: { deal_id: deal.id },
      });
      if (!sent.success) {
        console.error("Payment link SMS not sent:", sent.status, sent.errorMessage ?? sent.status);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      checkout_url: checkoutUrl,
      session_id: session.id,
      amount_cents: amount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("brandaro-create-payment-link error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}
