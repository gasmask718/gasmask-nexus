import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendSms as sendCanonicalSms } from "../_shared/sendSms.ts";
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
      const dealId = metadata.deal_id;
      const leadId = metadata.lead_id;

      // ─── CLOSE PIPELINE ADVANCEMENT (Phase 4/5/14) ─────────
      if (dealId || leadId) {
        console.log(`[BRANDARO-WEBHOOK] Close pipeline payment: deal=${dealId} lead=${leadId}`);
        const paymentAmount = (session.amount_total || 0) / 100;

        // Advance pipeline to "closed"
        const pipelineFilter = dealId
          ? supabase.from("brandaro_close_pipeline").update({
              stage: "closed",
              closed_at: new Date().toISOString(),
              payment_completed: true,
              payment_amount: paymentAmount,
              revenue_amount: paymentAmount,
              payment_link_clicked: true,
              package_tier: metadata.package_tier || "custom",
            }).eq("id", dealId)
          : supabase.from("brandaro_close_pipeline").update({
              stage: "closed",
              closed_at: new Date().toISOString(),
              payment_completed: true,
              payment_amount: paymentAmount,
              revenue_amount: paymentAmount,
              payment_link_clicked: true,
              package_tier: metadata.package_tier || "custom",
            }).eq("lead_id", leadId);

        const { error: pipeErr } = await pipelineFilter;
        if (pipeErr) console.error("[BRANDARO-WEBHOOK] Pipeline update error:", pipeErr);

        // ─── DESIGN LEARNING (Phase 14) ───────────────────────
        // Capture design data from the demo for revenue-weighted learning
        if (leadId) {
          const { data: demoScore } = await supabase
            .from("brandaro_demo_quality_scores")
            .select("design_score, uniqueness_score, conversion_score")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (demoScore) {
            // Update design profile with revenue signal
            await supabase.from("brandaro_call_patterns").insert({
              pattern_type: "design_revenue",
              pattern_data: {
                lead_id: leadId,
                payment_amount: paymentAmount,
                design_score: demoScore.design_score,
                conversion_score: demoScore.conversion_score,
                package_tier: metadata.package_tier,
                business_name: metadata.business_name,
              },
              source_call_ids: [],
              effectiveness_score: paymentAmount > 1500 ? 95 : paymentAmount > 750 ? 80 : 65,
            }).then(() => {});
          }

          // Cancel any remaining follow-ups for this lead
          await supabase
            .from("brandaro_followup_sequences")
            .update({ status: "cancelled" })
            .eq("lead_id", leadId)
            .eq("status", "pending");

          // Update lead status
          await supabase
            .from("brandaro_qualified_leads")
            .update({ status: "client", updated_at: new Date().toISOString() })
            .eq("id", leadId);

          // Send congratulations SMS
          const { data: lead } = await supabase
            .from("brandaro_qualified_leads")
            .select("phone, business_name")
            .eq("id", leadId)
            .single();

          if (lead?.phone) {
            const digits = lead.phone.replace(/\D/g, "");
            const normalizedPhone = digits.length === 10
              ? `+1${digits}`
              : digits.length === 11 && digits.startsWith("1")
              ? `+${digits}`
              : lead.phone;
            // Group C (transactional): payment confirmation for a completed purchase.
            // Stripe retries webhooks; the idempotency key is what keeps a
            // retry from re-texting the customer.
            const sent = await sendCanonicalSms({
              to: normalizedPhone,
              body: `🎉 Payment confirmed! We're getting started on ${lead.business_name}'s website right now. Our team will reach out within 24 hours with your first draft. Welcome aboard!`,
              sendClass: "transactional",
              purpose: "brandaro_payment_confirmed",
              idempotencyKey: `brandaro-paid-${leadId}`,
              skipCooldown: true,
              metadata: { lead_id: leadId },
            });
            if (!sent.success) {
              console.error("Congrats SMS not sent:", sent.status, sent.errorMessage ?? sent.status);
            }
          }
        }
      }

      if (!proposalId) {
        console.log("[BRANDARO-WEBHOOK] No proposal_id in metadata, skipping proposal flow");
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

      // FIX 3: Pipeline automator event for revenue attribution
      if (leadId) {
        try {
          await supabase.functions.invoke("brandaro-pipeline-automator", {
            body: {
              action: "record_event",
              lead_id: leadId,
              event_type: "revenue_recorded",
              message_content: `Payment confirmed: $${(session.amount_total || 0) / 100}`,
            },
          });

          await supabase
            .from("brandaro_qualified_leads")
            .update({
              converted: true,
              revenue_amount: (session.amount_total || 0) / 100,
              conversion_date: new Date().toISOString(),
            })
            .eq("id", leadId);

          console.log(`[BRANDARO-WEBHOOK] Revenue event + conversion recorded for lead ${leadId}`);
        } catch (revErr: any) {
          console.error("[BRANDARO-WEBHOOK] Revenue pipeline event failed:", revErr.message);
        }
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
