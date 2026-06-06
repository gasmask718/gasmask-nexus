// DD Sprint 5 — Refresh Stripe Connect status for a wholesaler.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ status: "key_not_ready" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    let q = supabase.from("wholesaler_profiles").select("id, stripe_connect_id");
    q = wholesalerId ? q.eq("id", wholesalerId) : q.eq("user_id", user.id);
    const { data: ws } = await q.maybeSingle();
    if (!ws?.stripe_connect_id) {
      return new Response(JSON.stringify({ status: "not_started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const acc = await stripe.accounts.retrieve(ws.stripe_connect_id);

    const payoutsEnabled = !!acc.payouts_enabled;
    const chargesEnabled = !!acc.charges_enabled;
    const status = payoutsEnabled ? "payouts_enabled" : (acc.details_submitted ? "pending" : "incomplete");

    await supabase
      .from("wholesaler_profiles")
      .update({
        stripe_payouts_enabled: payoutsEnabled,
        stripe_charges_enabled: chargesEnabled,
        stripe_connect_updated_at: new Date().toISOString(),
      })
      .eq("id", ws.id);

    return new Response(
      JSON.stringify({
        status,
        payouts_enabled: payoutsEnabled,
        charges_enabled: chargesEnabled,
        requirements: acc.requirements,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[dd-stripe-connect-status]", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
