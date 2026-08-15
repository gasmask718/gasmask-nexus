import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import Stripe from "https://esm.sh/stripe@14.14.0";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { vendor_id } = await req.json();
    if (!vendor_id) return new Response(JSON.stringify({ error: "vendor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: vendor } = await supabase.from("ut_vendors").select("*").eq("id", vendor_id).single();
    if (!vendor) throw new Error("Vendor not found");

    let accountId = vendor.stripe_connect_id;

    // Create Stripe Connect account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        metadata: { vendor_id },
      });
      accountId = account.id;
      await supabase.from("ut_vendors").update({ stripe_connect_id: accountId }).eq("id", vendor_id);
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: "https://unforgettabletimes.com/vendor/settings?refresh=true",
      return_url: "https://unforgettabletimes.com/vendor/settings?connected=true",
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url, account_id: accountId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("stripe-connect-onboard error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
