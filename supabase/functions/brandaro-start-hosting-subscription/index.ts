import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { ensureClientForJob, syncClientMRR } from "../_shared/brandaroClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * brandaro-start-hosting-subscription
 *
 * Step 16 (automated half): when a dev flips a paid build job to `live` on
 * /brandaro/builder, the client's monthly hosting subscription starts.
 *
 * INPUT:  { build_job_id, mode? }
 * OUTPUT: { created: true, subscription_id, ... } | { already: true, ... }
 *
 * Admin-only (JWT + has_role check in code). Idempotent: an existing active
 * subscription for the same build job short-circuits, and a unique partial
 * index on brandaro_subscriptions(project_id) stops any race.
 *
 * Mode resolution matches demo-stripe-checkout: body.mode -> STRIPE_MODE -> test.
 */

const HOSTING_TIER = "hosting"; // single flat price row in brandaro_stripe_config

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolveMode(bodyMode: unknown): "test" | "live" {
  if (bodyMode === "live" || bodyMode === "test") return bodyMode;
  return Deno.env.get("STRIPE_MODE") === "live" ? "live" : "test";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const buildJobId = typeof body.build_job_id === "string" ? body.build_job_id.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buildJobId)) {
      return json({ error: "build_job_id must be a valid UUID" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // --- caller must be a signed-in admin -------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin role required" }, 403);

    // --- load the build job ---------------------------------------------
    const { data: job, error: jobErr } = await admin
      .from("brandaro_build_jobs")
      .select("id, client_id, lead_id, demo_id, package_tier, build_status, intake_data")
      .eq("id", buildJobId)
      .maybeSingle();
    if (jobErr) return json({ error: `Job lookup failed: ${jobErr.message}` }, 500);
    if (!job) return json({ error: "Build job not found" }, 404);

    // --- duplicate guard #1: existing live subscription ------------------
    const { data: existingSub } = await admin
      .from("brandaro_subscriptions")
      .select("id, stripe_subscription_id, status")
      .eq("project_id", job.id)
      .in("status", ["active", "trialing", "past_due", "incomplete"])
      .maybeSingle();
    if (existingSub) {
      return json({
        already: true,
        subscription_id: existingSub.stripe_subscription_id,
        status: existingSub.status,
      });
    }

    const mode = resolveMode(body.mode);
    const stripeKey = mode === "live"
      ? Deno.env.get("STRIPE_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY_TEST");
    if (!stripeKey) return json({ error: `Stripe key not configured for ${mode} mode` }, 500);
    if (mode === "test" && !stripeKey.startsWith("sk_test_")) {
      return json({ error: "Test mode requires a sk_test_ key" }, 500);
    }

    // --- hosting price ----------------------------------------------------
    const { data: priceRow } = await admin
      .from("brandaro_stripe_config")
      .select("price_id, amount_cents")
      .eq("mode", mode)
      .eq("tier", HOSTING_TIER)
      .maybeSingle();
    if (!priceRow?.price_id) {
      return json(
        {
          error:
            `No monthly hosting price configured for ${mode} mode. ` +
            `Run brandaro-stripe-bootstrap-products first.`,
        },
        500,
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // --- resolve the Stripe customer -------------------------------------
    let customerId: string | undefined;
    let businessName: string | null = null;

    if (job.demo_id) {
      const { data: demo } = await admin
        .from("brandaro_demo_sites")
        .select("business_name, stripe_session_id")
        .eq("id", job.demo_id)
        .maybeSingle();
      businessName = demo?.business_name ?? null;
      if (demo?.stripe_session_id) {
        try {
          const session = await stripe.checkout.sessions.retrieve(demo.stripe_session_id);
          if (typeof session.customer === "string") customerId = session.customer;
          else if (session.customer && typeof session.customer === "object") {
            customerId = (session.customer as { id: string }).id;
          }
        } catch (e) {
          console.warn("[hosting-sub] session retrieve failed:", (e as Error).message);
        }
      }
    }

    const intake = (job.intake_data ?? {}) as Record<string, unknown>;
    const email = typeof intake.contact_email === "string" ? intake.contact_email.trim() : "";

    if (!customerId && email) {
      const found = await stripe.customers.list({ email, limit: 1 });
      customerId = found.data[0]?.id
        ?? (await stripe.customers.create({
              email,
              name: businessName ?? undefined,
              metadata: { build_job_id: job.id, brandaro: "hosting" },
            })).id;
    }

    if (!customerId) {
      return json(
        { error: "No Stripe customer could be resolved (no checkout session and no intake contact email)" },
        400,
      );
    }

    // --- create the subscription ------------------------------------------
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceRow.price_id }],
      metadata: {
        build_job_id: job.id,
        demo_id: job.demo_id ?? "",
        tier: job.package_tier ?? "",
        stripe_mode: mode,
        brandaro: "hosting",
      },
    });

    const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
      ?? (subscription.items?.data?.[0] as unknown as { current_period_end?: number })?.current_period_end;

    // Make sure the subscription is attached to the canonical client record so
    // MRR rolls up into the War Room / Revenue Analytics.
    const { client_id: clientId } = await ensureClientForJob(admin, {
      build_job_id: job.id,
      lead_id: (job as { lead_id?: string | null }).lead_id ?? null,
      business_name: businessName,
      email: email || null,
      tier: job.package_tier ?? null,
    });

    const { error: insErr } = await admin.from("brandaro_subscriptions").insert({
      client_id: clientId ?? job.client_id,
      project_id: job.id,
      service_type: "hosting",
      tier: job.package_tier ?? null,
      monthly_fee: (priceRow.amount_cents ?? 9900) / 100,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: subscription.status,
      started_at: new Date().toISOString(),
      next_billing_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
    if (insErr) {
      // Don't leave an untracked live subscription behind.
      try { await stripe.subscriptions.cancel(subscription.id); } catch (_) { /* noop */ }
      return json({ error: `Subscription recorded failed (rolled back): ${insErr.message}` }, 500);
    }

    // Recompute monthly_recurring from live subscriptions (never typed by hand).
    let mrr: number | null = null;
    if (clientId) mrr = await syncClientMRR(admin, clientId);

    console.log(`[hosting-sub] mode=${mode} job=${job.id} sub=${subscription.id} mrr=${mrr}`);

    return json({
      created: true,
      mode,
      subscription_id: subscription.id,
      customer_id: customerId,
      status: subscription.status,
      monthly_fee: (priceRow.amount_cents ?? 9900) / 100,
      client_id: clientId,
      monthly_recurring: mrr,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[brandaro-start-hosting-subscription]", message);
    return json({ error: message }, 500);
  }
});
