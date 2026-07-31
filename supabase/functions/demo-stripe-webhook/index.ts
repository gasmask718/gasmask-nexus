import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { isSuppressed } from "../_shared/dnc.ts";

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
  const secret =
    Deno.env.get("DEMO_STRIPE_WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  if (!secret || !stripeKey) {
    console.error("[demo-stripe-webhook] missing STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY");
    return new Response(JSON.stringify({ error: "webhook not configured" }), { status: 500 });
  }
  if (!sig) {
    return new Response(JSON.stringify({ error: "missing stripe-signature" }), { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch (err: any) {
    console.error("[demo-stripe-webhook] signature verification failed:", err?.message);
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

    // ---------- 4. Queue the build job ----------
    // Field mapping (spec -> brandaro_build_jobs):
    //   demo_id           -> demo_id
    //   client_id         -> client_id (null; no client record exists pre-intake)
    //   lead_id           -> lead_id
    //   business_name     -> (no column; lives on brandaro_demo_sites via demo_id)
    //   package_tier      -> package_tier
    //   build_status      -> build_status = 'pending'
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
        client_id: null,
        lead_id,
        package_tier: tier,
        build_status: "pending",
        build_engine,
        progress_stage: "awaiting_intake",
        deployed_at: null,
      })
      .select("id")
      .maybeSingle();
    if (jobErr) console.error("[demo-stripe-webhook] build job insert failed:", jobErr.message);
    build_job_id = job?.id ?? null;

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

          const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
          const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
          const from =
            Deno.env.get("BRANDARO_TWILIO_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER");

          let status = "failed";
          let providerId: string | null = null;
          let failure: string | null = "twilio not configured";

          if (sid && auth && from) {
            const resp = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: "Basic " + btoa(`${sid}:${auth}`),
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ To: phone, From: from, Body: body }),
              },
            );
            const tw = await resp.json().catch(() => ({}));
            if (resp.ok) {
              status = "sent";
              providerId = tw.sid ?? null;
              failure = null;
            } else {
              failure = tw?.message || `twilio ${resp.status}`;
              console.error("[demo-stripe-webhook] twilio send failed:", failure);
            }
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
