import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms as sendCanonicalSms } from "../_shared/sendSms.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { isSuppressed } from "../_shared/dnc.ts";
import { callDurable, BUILD_JOB_REF_PREFIX } from "../_shared/durable.ts";
import { ensureClientForJob } from "../_shared/brandaroClient.ts";
import { buildRevenueType, recordRevenue } from "../_shared/brandaroRevenue.ts";


/**
 * demo-stripe-webhook
 *
 * Public (verify_jwt = false). Stripe calls this directly.
 * Handles checkout.session.completed for sessions created by demo-stripe-checkout.
 *
 * Contract: ONLY signature failure returns a non-200. Everything after that is
 * best-effort and logged — Stripe must never be put into a retry loop by our
 * own downstream failures.
 *
 * KNOWN GAP: there is no intake flow yet. INTAKE_BASE_URL is a placeholder.
 */

// TODO(gap): replace once the real intake flow exists.
const INTAKE_BASE_URL =
  Deno.env.get("BRANDARO_INTAKE_URL") || "https://brandarodigital.com/intake";

const ALERT_EMAIL = Deno.env.get("BRANDARO_ALERT_EMAIL") || "david@brandarodigital.com";

function ok(body: unknown = { received: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // ---------- 1. Signature verification (the ONLY hard failure) ----------
  // Dedicated signing secret for the demo endpoint; falls back to the shared one.
  // A separate TEST-mode endpoint in Stripe signs with its own secret, so we try
  // both and accept whichever verifies.
  const liveSecret =
    Deno.env.get("DEMO_STRIPE_WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const testSecret = Deno.env.get("DEMO_STRIPE_WEBHOOK_SECRET_TEST");
  const liveKey = Deno.env.get("STRIPE_SECRET_KEY");
  const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  const candidates = [
    { mode: "live", secret: liveSecret, key: liveKey },
    { mode: "test", secret: testSecret, key: testKey },
  ].filter((c) => c.secret && c.key) as { mode: string; secret: string; key: string }[];

  if (candidates.length === 0) {
    console.error("[demo-stripe-webhook] missing STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY");
    return new Response(JSON.stringify({ error: "webhook not configured" }), { status: 500 });
  }
  if (!sig) {
    return new Response(JSON.stringify({ error: "missing stripe-signature" }), { status: 400 });
  }

  let event: Stripe.Event | null = null;
  let lastErr = "";
  for (const c of candidates) {
    try {
      const stripe = new Stripe(c.key, { apiVersion: "2025-08-27.basil" });
      event = await stripe.webhooks.constructEventAsync(raw, sig, c.secret);
      console.log(`[demo-stripe-webhook] signature verified in ${c.mode} mode`);
      break;
    } catch (err: any) {
      lastErr = err?.message ?? String(err);
    }
  }

  if (!event) {
    console.error("[demo-stripe-webhook] signature verification failed:", lastErr);
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 400 });
  }


  if (event.type !== "checkout.session.completed") {
    return ok({ received: true, ignored: event.type });
  }

  // ---------- everything below is best-effort; always return 200 ----------
  try {
    const session = event.data.object as Stripe.Checkout.Session;
    const md = (session.metadata || {}) as Record<string, string>;
    const demo_id = md.demo_id;
    const tier = md.tier || null;
    const business_name = md.business_name || null;

    if (!demo_id) {
      console.error("[demo-stripe-webhook] session has no demo_id metadata:", session.id);
      return ok({ received: true, skipped: "no demo_id" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const amount = (session.amount_total ?? 0) / 100;
    const customer_email =
      session.customer_details?.email || (md.customer_email as string) || null;

    // ---------- 3. Mark the demo paid ----------
    const { data: demo, error: demoErr } = await supabase
      .from("brandaro_demo_sites")
      .update({
        converted_to_paid: true,
        paid_amount: amount,
        paid_tier: tier,
        paid_at: new Date().toISOString(),
        stripe_session_id: session.id,
      })
      .eq("id", demo_id)
      .select("id, lead_id, business_name, phone_e164, demo_url")
      .maybeSingle();

    if (demoErr) console.error("[demo-stripe-webhook] demo update failed:", demoErr.message);
    if (!demo) console.error("[demo-stripe-webhook] no demo row for", demo_id);

    const lead_id = demo?.lead_id ?? null;

    // Lead lookup for phone / client identity.
    let lead: any = null;
    if (lead_id) {
      const { data } = await supabase
        .from("brandaro_qualified_leads")
        .select("id, phone_number, email, business_name")
        .eq("id", lead_id)
        .maybeSingle();
      lead = data;
    }
    const phone = demo?.phone_e164 || lead?.phone_number || null;

    // ---------- 3b. Canonical client record ----------
    // brandaro_clients is what the War Room, Production Pipeline, Review Queue
    // and monthly reporting all read. Create it at payment time (with Stripe
    // identity) so revenue lands immediately; brandaro-intake enriches it with
    // the real business details later.
    const { client_id, created: clientCreated, error: clientErr } = await ensureClientForJob(
      supabase,
      {
        lead_id,
        business_name: business_name || demo?.business_name || lead?.business_name || null,
        email: customer_email || lead?.email || null,
        phone,
        tier,
        amount_paid: amount,
      },
    );
    if (clientErr) console.error("[demo-stripe-webhook] client ensure failed:", clientErr);
    else console.log(`[demo-stripe-webhook] client ${client_id} (created=${clientCreated})`);

    // ---------- 3c. Cash ledger ----------
    // brandaro_revenue_tracking is the only source /brandaro/revenue reads.
    // Keyed on the checkout session id, so Stripe retries cannot double-count.
    try {
      const { data: demoIndustry } = await supabase
        .from("brandaro_demo_sites")
        .select("industry")
        .eq("id", demo_id)
        .maybeSingle();

      await recordRevenue(supabase, {
        amount,
        revenue_type: buildRevenueType(tier),
        stripe_reference: session.id,
        source: "stripe_checkout",
        client_id,
        lead_id,
        description:
          business_name || demo?.business_name || lead?.business_name || "Website build",
        industry: demoIndustry?.industry ?? null,
      });
    } catch (e: any) {
      console.error("[demo-stripe-webhook] revenue ledger step failed:", e?.message);
    }


    // ---------- 4. Queue the build job ----------
    // Field mapping (spec -> brandaro_build_jobs):
    //   demo_id           -> demo_id
    //   client_id         -> client_id (canonical brandaro_clients row, created above)
    //   lead_id           -> lead_id
    //   business_name     -> (no column; lives on brandaro_demo_sites via demo_id)
    //   package_tier      -> package_tier
    //   build_status      -> build_status = 'queued' (first value the CHECK allows)
    //   deployed_at       -> deployed_at = null
    //   lead_phone        -> (no column; reachable via lead_id -> phone_number)
    //   amount_paid       -> (no column; brandaro_demo_sites.paid_amount)
    //   stripe_session_id -> (no column; brandaro_demo_sites.stripe_session_id)
    //   intake_completed  -> progress_stage = 'awaiting_intake' (flips when intake lands)
    //   build_engine      -> starter = 'durable'; pro/custom = 'native' (Vercel template clone)
    const build_engine = tier === "starter" ? "durable" : "native";
    let build_job_id: string | null = null;
    const { data: job, error: jobErr } = await supabase
      .from("brandaro_build_jobs")
      .insert({
        demo_id,
        client_id,
        lead_id,
        package_tier: tier,
        build_status: "queued",
        build_engine,
        progress_stage: "awaiting_intake",
        deployed_at: null,
      })
      .select("id")
      .maybeSingle();
    if (jobErr) console.error("[demo-stripe-webhook] build job insert failed:", jobErr.message);
    build_job_id = job?.id ?? null;

    // ---------- 4b. STARTER TIER: Durable builds the full site automatically ----------
    // Pipeline Step 14 (Section 1.1): "For starter tier: Durable API builds the full
    // site automatically" — no dev review, fully automated. Pro/custom are handled by
    // a separate (not-yet-built) path and intentionally do nothing here.
    if (tier === "starter" && build_job_id) {
      try {
        const { data: demoFull } = await supabase
          .from("brandaro_demo_sites")
          .select(
            "id, business_name, industry, city, state, services_inferred, phone_e164, seo_text",
          )
          .eq("id", demo_id)
          .maybeSingle();

        const durableRes = await callDurable({
          business_name: demoFull?.business_name || business_name || lead?.business_name,
          industry: demoFull?.industry ?? null,
          location: { city: demoFull?.city ?? null, state: demoFull?.state ?? null },
          phone: demoFull?.phone_e164 || phone,
          email: customer_email,
          services: demoFull?.services_inferred || [],
          description: demoFull?.seo_text ?? null,
          // REAL paid build, not a demo.
          purpose: "paid_build",
          webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/brandaro-durable-webhook`,
          external_reference: `${BUILD_JOB_REF_PREFIX}${build_job_id}`,
        });

        if (durableRes.ok) {
          const { error: upErr } = await supabase
            .from("brandaro_build_jobs")
            .update({
              durable_site_id: durableRes.site_id,
              durable_generated_url: durableRes.site_url ?? null,
              durable_job_status: "processing",
              durable_last_error: null,
              build_status: "building",
              progress_stage: "durable_generating",
              started_at: new Date().toISOString(),
            })
            .eq("id", build_job_id);
          if (upErr) {
            console.error("[demo-stripe-webhook] build job durable update failed:", upErr.message);
          }
        } else {
          console.error("[demo-stripe-webhook] Durable call failed:", durableRes.error);
          await supabase
            .from("brandaro_build_jobs")
            .update({
              durable_job_status: "error",
              durable_last_error: durableRes.error,
              build_status: "failed",
              error_log: { stage: "durable_start", error: durableRes.error },
            })
            .eq("id", build_job_id);
        }
      } catch (e: any) {
        console.error("[demo-stripe-webhook] starter auto-build step threw:", e?.message);
      }
    }

    // ---------- 5. Client SMS (DNC-gated) ----------
    if (phone) {
      try {
        const suppression = await isSuppressed(supabase, phone);
        if (suppression.blocked) {
          console.warn(
            `[demo-stripe-webhook] SMS blocked for ${phone} — ${suppression.reason} (${suppression.source})`,
          );
          await supabase.from("brandaro_message_log").insert({
            lead_id,
            demo_id,
            channel: "sms",
            provider: "twilio",
            destination: phone,
            message_body: null,
            send_status: "blocked",
            failure_reason: `suppressed:${suppression.reason}`,
            sent_at: null,
          });
        } else {
          const intakeUrl = `${INTAKE_BASE_URL}?demo=${demo_id}`;
          const body =
            `Payment confirmed! We're building your site now. ` +
            `Complete your intake form to get started: ${intakeUrl}`;

          // Group C (transactional): post-payment intake link. The marketing
          // suppression check above already ran; the shared module adds the
          // legal-STOP gate that applies to every class.
          const sent = await sendCanonicalSms({
            to: phone,
            body,
            sendClass: "transactional",
            purpose: "brandaro_intake_link",
            idempotencyKey: `demo-paid-intake-${demo_id}`,
            from: Deno.env.get("BRANDARO_TWILIO_NUMBER") ?? null,
            skipCooldown: true,
            metadata: { lead_id, demo_id },
          });
          const status = sent.success ? "sent" : sent.blocked ? "blocked" : "failed";
          const providerId = sent.providerMessageId;
          const failure = sent.success
            ? null
            : (sent.errorMessage ?? sent.status ?? "send failed");
          if (!sent.success) {
            console.error("[demo-stripe-webhook] sms not sent:", failure);
          }

          await supabase.from("brandaro_message_log").insert({
            lead_id,
            demo_id,
            channel: "sms",
            provider: "twilio",
            destination: phone,
            message_body: body,
            send_status: status,
            failure_reason: failure,
            provider_message_id: providerId,
            sent_at: status === "sent" ? new Date().toISOString() : null,
          });
        }
      } catch (e: any) {
        console.error("[demo-stripe-webhook] SMS step failed:", e?.message);
      }
    } else {
      console.warn("[demo-stripe-webhook] no phone on demo/lead; SMS skipped for", demo_id);
    }

    // ---------- 6. Internal email alert ----------
    try {
      const { error: mailErr } = await supabase.functions.invoke("brandaro-send-email", {
        body: {
          template: "paid-conversion-alert",
          to: ALERT_EMAIL,
          data: {
            business_name: business_name || demo?.business_name || lead?.business_name,
            tier,
            amount,
            phone,
            customer_email,
            demo_id,
            demo_url: demo?.demo_url,
            stripe_session_id: session.id,
            build_job_id,
          },
        },
      });
      if (mailErr) console.error("[demo-stripe-webhook] alert email failed:", mailErr.message);
    } catch (e: any) {
      console.error("[demo-stripe-webhook] alert email threw:", e?.message);
    }

    return ok({ received: true });
  } catch (err: any) {
    // Post-verification failures never bubble to Stripe.
    console.error("[demo-stripe-webhook] unhandled post-verification error:", err?.message, err);
    return ok({ received: true, error_logged: true });
  }
});
