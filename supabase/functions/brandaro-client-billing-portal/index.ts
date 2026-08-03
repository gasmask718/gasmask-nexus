// brandaro-client-billing-portal
// Client Portal (CLIENT-3) — creates a Stripe Billing Portal session for the
// signed-in receptionist client so they can update their card, download
// invoices, or cancel. The Stripe customer is resolved from the caller's own
// client row, never from request data.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_ORIGIN = Deno.env.get("BRANDARO_PUBLIC_ORIGIN") ?? "https://brandarodigital.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);
    const user = userData.user;

    let { data: client } = await admin
      .from("brandaro_receptionist_clients")
      .select("id,email,stripe_customer_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!client && user.email) {
      const { data: byEmail } = await admin
        .from("brandaro_receptionist_clients")
        .select("id,email,stripe_customer_id")
        .ilike("email", user.email)
        .maybeSingle();
      client = byEmail;
    }
    if (!client) return json({ error: "No receptionist account found for this login" }, 404);
    if (!client.stripe_customer_id) {
      return json({ error: "No Stripe billing account is linked to your record yet" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const returnUrl =
      typeof body?.return_url === "string" && body.return_url.startsWith("http")
        ? body.return_url
        : `${APP_ORIGIN}/client-portal/billing`;

    // Try the configured mode first, then the other key — a customer created in
    // test mode is invisible to the live key and vice versa.
    const liveKey = Deno.env.get("STRIPE_SECRET_KEY");
    const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
    const preferLive = Deno.env.get("STRIPE_MODE") === "live";
    const candidates = (preferLive ? [liveKey, testKey] : [testKey, liveKey]).filter(
      Boolean,
    ) as string[];
    if (!candidates.length) return json({ error: "Stripe is not configured" }, 500);

    let lastError = "";
    for (const key of candidates) {
      try {
        const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
        const session = await stripe.billingPortal.sessions.create({
          customer: client.stripe_customer_id,
          return_url: returnUrl,
        });
        return json({ url: session.url });
      } catch (e) {
        lastError = String((e as Error)?.message ?? e);
        console.error("[brandaro-client-billing-portal] stripe attempt failed:", lastError);
      }
    }

    return json({ error: `Could not open billing portal: ${lastError}` }, 502);
  } catch (err) {
    console.error("[brandaro-client-billing-portal] error", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
