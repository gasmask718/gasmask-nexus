// DD Sprint 5 — Stripe Connect Express onboarding for wholesalers.
// Key-ready: reads STRIPE_SECRET_KEY_DD with STRIPE_SECRET_KEY fallback.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY_DD not configured", key_ready: false }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authenticate caller
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: authData } = await userClient.auth.getUser();
    const user = authData.user;
    if (!user) throw new Error("Not authenticated");

    const body = await req.json().catch(() => ({}));
    const wholesalerId = body.wholesaler_id as string | undefined;

    let q = supabase.from("wholesaler_profiles").select("*");
    q = wholesalerId ? q.eq("id", wholesalerId) : q.eq("user_id", user.id);
    const { data: ws, error: wsErr } = await q.maybeSingle();
    if (wsErr) throw wsErr;
    if (!ws) throw new Error("Wholesaler profile not found");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let accountId = ws.stripe_connect_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: { name: ws.company_name ?? undefined },
        email: ws.email ?? undefined,
        metadata: { dd_wholesaler_id: ws.id },
      });
      accountId = account.id;
      await supabase
        .from("wholesaler_profiles")
        .update({
          stripe_connect_id: accountId,
          stripe_connect_updated_at: new Date().toISOString(),
        })
        .eq("id", ws.id);
    }

    const origin = req.headers.get("origin") || "https://gasmask-os-nexus.lovable.app";
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/portal/wholesaler/payouts?refresh=1`,
      return_url: `${origin}/portal/wholesaler/payouts?connected=1`,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({ url: link.url, account_id: accountId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[dd-stripe-connect-onboard]", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
