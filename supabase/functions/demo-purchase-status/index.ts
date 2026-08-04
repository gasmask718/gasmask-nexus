import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * demo-purchase-status
 *
 * Public (verify_jwt = false). Called by the PurchaseConfirmed page in
 * brandaro-base after Stripe redirects a paying customer back.
 *
 * INPUT:  { demo_id, session }
 * OUTPUT: { status: "paid" | "processing" | "not_found" | "mismatch", ... }
 *
 * Read-only. It never marks anything paid — demo-stripe-webhook is the sole
 * writer of paid_at / converted_to_paid. This exists purely so the buyer sees
 * a truthful confirmation instead of a lead-intake thank-you page.
 *
 * Access control: the caller must present BOTH the demo_id and the exact
 * stripe_session_id recorded for it. A demo_id alone reveals nothing.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const support_email = Deno.env.get("BRANDARO_SUPPORT_EMAIL") || "support@brandarodigital.com";
  const intake_base = Deno.env.get("BRANDARO_INTAKE_URL") || "https://www.brandarodigital.com/intake";

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ status: "not_found", error: "Invalid JSON body", support_email }, 400);
    }

    const demo_id = typeof body.demo_id === "string" ? body.demo_id.trim() : "";
    const session = typeof body.session === "string" ? body.session.trim() : "";

    if (!UUID_RE.test(demo_id) || !session) {
      return json({ status: "not_found", error: "demo_id and session are required", support_email }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: demo, error } = await supabase
      .from("brandaro_demo_sites")
      .select("id, business_name, paid_at, paid_tier, paid_amount, stripe_session_id, converted_to_paid")
      .eq("id", demo_id)
      .maybeSingle();

    if (error) {
      console.error("[demo-purchase-status] lookup failed:", error.message);
      return json({ status: "processing", support_email }, 200);
    }
    if (!demo) {
      return json({ status: "not_found", support_email }, 200);
    }

    // Webhook hasn't landed yet — the session id isn't recorded at all.
    // Truthful "processing", not a failure: the customer's card IS charged.
    if (!demo.stripe_session_id) {
      return json({ status: "processing", business_name: demo.business_name, support_email }, 200);
    }

    if (demo.stripe_session_id !== session) {
      console.warn(`[demo-purchase-status] session mismatch for demo ${demo_id}`);
      return json({ status: "mismatch", support_email }, 200);
    }

    if (!demo.paid_at) {
      return json({ status: "processing", business_name: demo.business_name, support_email }, 200);
    }

    // NOTE: brandaro_clients has no demo_id column, so there is no safe join
    // back to the buyer's email here. The page simply omits it rather than
    // guessing — Stripe emails the receipt regardless.
    return json({
      status: "paid",
      business_name: demo.business_name,
      tier: demo.paid_tier,
      amount: demo.paid_amount,
      intake_url: `${intake_base}?demo_id=${encodeURIComponent(demo_id)}`,
      support_email,
    });
  } catch (e) {
    console.error("[demo-purchase-status] error", e instanceof Error ? e.message : e);
    return json({ status: "processing", support_email }, 200);
  }
});
