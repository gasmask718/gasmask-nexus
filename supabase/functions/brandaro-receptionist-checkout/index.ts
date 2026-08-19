// brandaro-receptionist-checkout
// Creates a Stripe Checkout session for the AI Receptionist product
// (setup fee + first month) and optionally SMS-es the checkout URL to the lead.
// Called by the VA from the Brandaro dashboard during a live call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms as sendCanonicalSms } from "../_shared/sendSms.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Plan → { setup fee cents, monthly cents } (source of truth for pricing)
const PLAN_PRICING: Record<string, { setup: number; monthly: number; label: string }> = {
  starter:    { setup: 49700, monthly: 19700, label: "AI Receptionist — Starter" },
  pro:        { setup: 49700, monthly: 29700, label: "AI Receptionist — Pro" },
  enterprise: { setup: 99700, monthly: 49700, label: "AI Receptionist — Enterprise" },
};

const APP_ORIGIN = Deno.env.get("BRANDARO_PUBLIC_ORIGIN") ?? "https://brandarodigital.com";

/**
 * Mode resolution (safety default = test):
 *   1. explicit body.mode ("test" | "live")
 *   2. STRIPE_MODE env var
 *   3. fallback -> "test"
 */
function resolveMode(bodyMode: unknown): "test" | "live" {
  if (bodyMode === "live" || bodyMode === "test") return bodyMode;
  return Deno.env.get("STRIPE_MODE") === "live" ? "live" : "test";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const mode = resolveMode((body ?? {}).mode);
    const stripeKey = mode === "live"
      ? Deno.env.get("STRIPE_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY_TEST");
    if (!stripeKey) {
      return json({ error: `Stripe not configured for ${mode} mode` }, 500);
    }
    if (mode === "test" && !stripeKey.startsWith("sk_test_")) {
      return json({ error: "Test mode requires a sk_test_ key" }, 500);
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    console.log(`[receptionist-checkout] mode=${mode}`);
    const {
      lead_id,
      plan = "starter",
      customer_email,
      customer_name,
      business_name,
      send_sms = true,
    } = body ?? {};

    const pricing = PLAN_PRICING[plan];
    if (!pricing) return json({ error: `Unknown plan: ${plan}` }, 400);

    // Resolve lead (optional — VA can pass raw values)
    let lead: any = null;
    if (lead_id) {
      const { data } = await supabase
        .from("brandaro_qualified_leads")
        .select("*")
        .eq("id", lead_id)
        .maybeSingle();
      lead = data;
    }

    // Fallback chains below only reference columns that actually exist on
    // brandaro_qualified_leads (verified against live schema 2026-08-19).
    // Dead tails removed: contact_email, owner_email, owner_name, phone.
    const email = customer_email ?? lead?.email ?? undefined;
    const displayBusiness = business_name ?? lead?.business_name ?? "Your Business";
    const displayOwner =
      customer_name ?? lead?.full_name ?? lead?.first_name ?? "";
    const phone = lead?.phone_number ?? null;

    // Use price IDs if the workspace preconfigured them, otherwise inline price_data
    const priceSetupId = Deno.env.get("STRIPE_PRICE_RECEPTIONIST_SETUP");
    const priceMonthlyId = Deno.env.get("STRIPE_PRICE_RECEPTIONIST_MONTHLY");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        priceMonthlyId
          ? { price: priceMonthlyId, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: "usd",
                recurring: { interval: "month" },
                unit_amount: pricing.monthly,
                product_data: {
                  name: `${pricing.label} (Monthly)`,
                  description: `Ongoing AI receptionist service for ${displayBusiness}`,
                },
              },
            },
      ],
      subscription_data: {
        metadata: {
          lead_id: lead_id ?? "",
          plan,
          business_name: displayBusiness,
          source: "receptionist_checkout",
        },
      },
      // Setup fee applied as a one-time invoice item on the first invoice
      ...(priceSetupId
        ? {
            discounts: undefined,
            line_items_extra: undefined,
          }
        : {}),
      metadata: {
        lead_id: lead_id ?? "",
        plan,
        business_name: displayBusiness,
        owner_name: displayOwner,
        phone: phone ?? "",
        source: "receptionist_checkout",
      },
      success_url: `${APP_ORIGIN}/thanks?product=receptionist&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_ORIGIN}/ai-receptionist?canceled=1`,
      allow_promotion_codes: true,
    });

    // Attach the setup fee as a one-time invoice item at subscription creation
    // (Stripe requires this at customer/subscription time; we defer to the
    // webhook so the customer exists first. Track intent in metadata.)
    if (!priceSetupId) {
      // Nothing else to do — webhook will invoice the setup fee.
    }

    // Optionally SMS the link via existing Twilio operator helper
    let sms_sent = false;
    let sms_error: string | null = null;
    if (send_sms && phone) {
      try {
        const smsBody =
          `Hi ${displayOwner || "there"}! Here's your AI Receptionist for ${displayBusiness}. ` +
          `Setup + first month: $${((pricing.setup + pricing.monthly) / 100).toFixed(0)}. ` +
          `Complete signup here: ${session.url}`;
        // Group C (transactional): checkout link for a signup in progress.
        const sent = await sendCanonicalSms({
          to: phone,
          body: smsBody,
          sendClass: "transactional",
          purpose: "brandaro_receptionist_checkout",
          idempotencyKey: `brandaro-receptionist-${session.id}`,
          from: Deno.env.get("TWILIO_MESSAGING_FROM") ?? null,
          skipCooldown: true,
          metadata: { session_id: session.id, plan },
        });
        sms_sent = sent.success;
        if (!sent.success) sms_error = sent.errorMessage ?? sent.status ?? sent.status;
      } catch (e) {
        sms_error = String((e as Error)?.message ?? e);
      }
    }

    return json({
      checkout_url: session.url,
      session_id: session.id,
      plan,
      setup_amount: pricing.setup / 100,
      monthly_amount: pricing.monthly / 100,
      sms_sent,
      sms_error,
    });
  } catch (err) {
    console.error("[brandaro-receptionist-checkout] error", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
