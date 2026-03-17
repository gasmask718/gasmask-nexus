import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const webhookSecret = Deno.env.get("BRANDARO_STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("BRANDARO_STRIPE_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "No signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify Stripe signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`[BRANDARO-WEBHOOK] Processing event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      const proposalId = metadata.proposal_id;

      if (!proposalId) {
        console.log("[BRANDARO-WEBHOOK] No proposal_id in metadata, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // IDEMPOTENCY: Check if already processed
      const { data: existing } = await supabase
        .from("brandaro_proposals")
        .select("payment_status")
        .eq("id", proposalId)
        .single();

      if (existing?.payment_status === "paid") {
        console.log(`[BRANDARO-WEBHOOK] Proposal ${proposalId} already paid, skipping`);
        return new Response(JSON.stringify({ received: true, already_processed: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Call brandaro-post-payment with verified data
      const { data: postResult, error: postErr } = await supabase.functions.invoke(
        "brandaro-post-payment",
        {
          body: {
            proposal_id: proposalId,
            payment_amount: (session.amount_total || 0) / 100,
            stripe_checkout_id: session.id,
            stripe_customer_id: session.customer as string,
            webhook_verified: true,
          },
        }
      );

      if (postErr) {
        console.error("[BRANDARO-WEBHOOK] Post-payment error:", postErr);
        // Log failure for retry
        await supabase.from("brandaro_job_failures").insert({
          job_type: "post_payment",
          entity_id: proposalId,
          error_message: postErr.message || "Post-payment invocation failed",
          status: "pending_retry",
          retry_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        });
      } else {
        console.log(`[BRANDARO-WEBHOOK] Post-payment success for ${proposalId}`, postResult);
      }

      // If maintenance was selected, create Stripe subscription
      if (metadata.include_maintenance === "true" && session.customer) {
        try {
          const subscription = await stripe.subscriptions.create({
            customer: session.customer as string,
            items: [{ price: "price_1TByoDLhpzgs5Jby2twL0566" }], // maintenance price
            metadata: { proposal_id: proposalId, lead_id: metadata.lead_id || "" },
          });
          console.log(`[BRANDARO-WEBHOOK] Maintenance subscription created: ${subscription.id}`);

          // Store subscription ID on client record
          const { data: proposal } = await supabase
            .from("brandaro_proposals")
            .select("lead_id")
            .eq("id", proposalId)
            .single();

          if (proposal?.lead_id) {
            await supabase
              .from("brandaro_subscriptions")
              .update({ stripe_subscription_id: subscription.id })
              .eq("client_id", (await supabase
                .from("brandaro_clients")
                .select("id")
                .eq("lead_id", proposal.lead_id)
                .single()).data?.id);
          }
        } catch (subErr: any) {
          console.error("[BRANDARO-WEBHOOK] Subscription creation error:", subErr.message);
        }
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[BRANDARO-WEBHOOK] Invoice paid: ${invoice.id}`);
      // Future: track recurring payments
    } else if (event.type === "customer.subscription.created") {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[BRANDARO-WEBHOOK] Subscription created: ${subscription.id}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[BRANDARO-WEBHOOK] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
