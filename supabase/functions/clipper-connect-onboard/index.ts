// Dynasty Clipper Nation — create or refresh a Stripe Connect Express onboarding link for a clipper.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clipper_id } = await req.json();
    if (!clipper_id) throw new Error("clipper_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // 1. Load clipper
    const { data: clipper, error: cErr } = await (supabase as any)
      .from("clipper_accounts")
      .select("id, email, full_name, stripe_connect_id, stripe_connect_onboarded")
      .eq("id", clipper_id)
      .maybeSingle();

    if (cErr || !clipper) throw new Error("Clipper not found");
    if (!clipper.email) throw new Error("Clipper has no email on file");

    // 2. Ensure a Stripe Connect account exists
    let accountId: string | null = clipper.stripe_connect_id ?? null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: clipper.email,
        capabilities: { transfers: { requested: true } },
        metadata: {
          clipper_id: clipper.id,
          clipper_name: clipper.full_name ?? "",
          platform: "dynasty_clipper_nation",
        },
      });
      accountId = account.id;

      await (supabase as any)
        .from("clipper_accounts")
        .update({ stripe_connect_id: accountId })
        .eq("id", clipper_id);
    }

    // 3. Create onboarding link
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/$/, "") ||
      "https://dynastyclipper.io";

    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: `${origin}/portal/settings?connect=refresh`,
      return_url: `${origin}/portal/settings?connect=complete`,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({ url: link.url, account_id: accountId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[clipper-connect-onboard] error", e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message) }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
