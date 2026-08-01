// brandaro-receptionist-webhook
// Stripe webhook for the AI Receptionist product.
// Register in Stripe dashboard with events: checkout.session.completed,
// invoice.payment_succeeded, customer.subscription.deleted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const liveSecret =
    Deno.env.get("RECEPTIONIST_STRIPE_WEBHOOK_SECRET") ||
    Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const testSecret = Deno.env.get("RECEPTIONIST_STRIPE_WEBHOOK_SECRET_TEST");
  if (!liveSecret && !testSecret) {
    return json({ error: "Stripe webhook not configured" }, 500);
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  // Verify against whichever endpoint secret matches (live or test).
  const verifier = new Stripe("sk_placeholder", { apiVersion: "2025-08-27.basil" });
  let event: Stripe.Event | null = null;
  for (const secret of [liveSecret, testSecret]) {
    if (!secret) continue;
    try {
      event = await verifier.webhooks.constructEventAsync(rawBody, signature!, secret);
      break;
    } catch { /* try next secret */ }
  }
  if (!event) {
    console.error("[receptionist-webhook] signature verification failed");
    return json({ error: "Invalid signature" }, 400);
  }

  const stripeKey = event.livemode
    ? Deno.env.get("STRIPE_SECRET_KEY")
    : (Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? Deno.env.get("STRIPE_SECRET_KEY"));
  if (!stripeKey) return json({ error: "Stripe key missing" }, 500);
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  console.log(`[receptionist-webhook] event=${event.type} livemode=${event.livemode}`);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.source !== "receptionist_checkout") {
        // Not our product — ignore silently, other webhooks handle it.
        return json({ received: true, ignored: "other_source" });
      }

      const lead_id = session.metadata?.lead_id || null;
      const plan = session.metadata?.plan ?? "starter";
      const business_name = session.metadata?.business_name ?? "Receptionist Client";
      const owner_name = session.metadata?.owner_name ?? null;
      const phone = session.metadata?.phone ?? null;
      const email = session.customer_details?.email ?? session.customer_email ?? "";

      // Load lead for enrichment (city/state/industry)
      let lead: any = null;
      if (lead_id) {
        const { data } = await supabase
          .from("brandaro_qualified_leads")
          .select("*")
          .eq("id", lead_id)
          .maybeSingle();
        lead = data;
      }

      const monthlyByPlan: Record<string, number> = { starter: 197, pro: 297, enterprise: 497 };
      const setupByPlan: Record<string, number> = { starter: 497, pro: 497, enterprise: 997 };

      // INSERT client row
      const { data: client, error: insertErr } = await supabase
        .from("brandaro_receptionist_clients")
        .insert({
          qualified_lead_id: lead_id,
          business_name: lead?.business_name ?? business_name,
          owner_name: owner_name ?? lead?.owner_name ?? null,
          phone: lead?.phone_number ?? lead?.phone ?? phone ?? "",
          email,
          city: lead?.city ?? null,
          state: lead?.state ?? null,
          industry: lead?.industry ?? null,
          plan,
          monthly_amount: monthlyByPlan[plan] ?? 197,
          setup_fee_amount: setupByPlan[plan] ?? 497,
          setup_fee_paid: true,
          setup_fee_paid_at: new Date().toISOString(),
          stripe_customer_id: (session.customer as string) ?? null,
          stripe_subscription_id: (session.subscription as string) ?? null,
          status: "onboarding",
          onboarded_at: new Date().toISOString(),
          next_billing_date: nextMonthDate(),
        })
        .select("*")
        .single();

      if (insertErr) {
        console.error("[receptionist-webhook] insert client failed", insertErr);
        return json({ error: insertErr.message }, 500);
      }

      // Add setup fee as one-time invoice item on the subscription's first invoice
      // (customer + subscription now exist).
      if (session.customer && !Deno.env.get("STRIPE_PRICE_RECEPTIONIST_SETUP")) {
        try {
          await stripe.invoiceItems.create({
            customer: session.customer as string,
            amount: (setupByPlan[plan] ?? 497) * 100,
            currency: "usd",
            description: `AI Receptionist Setup Fee — ${business_name}`,
          });
        } catch (e) {
          console.warn("[receptionist-webhook] setup invoice item skipped", e);
        }
      }

      // Update lead → closed_won
      if (lead_id) {
        await supabase
          .from("brandaro_qualified_leads")
          .update({ lead_status: "client", pipeline_stage: "closed_won" })
          .eq("id", lead_id);
      }

      // Fire off provisioning (Retell agent + Twilio number). Non-blocking best-effort.
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        await fetch(`${supabaseUrl}/functions/v1/brandaro-provision-receptionist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ client_id: client.id }),
        });
      } catch (e) {
        console.error("[receptionist-webhook] provisioning invoke failed", e);
      }

      return json({ received: true, client_id: client.id });
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string | null;
      if (subscriptionId) {
        await supabase
          .from("brandaro_receptionist_clients")
          .update({ next_billing_date: nextMonthDate() })
          .eq("stripe_subscription_id", subscriptionId);
      }
      return json({ received: true });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("brandaro_receptionist_clients")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: "stripe_subscription_deleted",
        })
        .eq("stripe_subscription_id", sub.id);
      return json({ received: true });
    }

    return json({ received: true, ignored: event.type });
  } catch (err) {
    console.error("[receptionist-webhook] handler error", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function nextMonthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
