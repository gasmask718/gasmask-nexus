// Dynasty Direct — create or refresh a Stripe Connect Express onboarding link.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { partner_id } = await req.json();
    if (!partner_id) throw new Error("partner_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    const { data: partner, error } = await supabase
      .from("dd_partner_profiles").select("*").eq("id", partner_id).maybeSingle();
    if (error || !partner) throw new Error("partner not found");

    let accountId = partner.stripe_connect_account_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: partner.email,
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { dd_partner_id: partner_id },
      });
      accountId = account.id;
      await supabase.from("dd_partner_profiles")
        .update({ stripe_connect_account_id: accountId }).eq("id", partner_id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: "https://dynastydirect.com/partner/settings",
      return_url: "https://dynastydirect.com/partner/settings?onboarded=true",
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: link.url, account_id: accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
