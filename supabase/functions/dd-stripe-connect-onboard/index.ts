// Dynasty Direct — create or resume a Stripe Connect Express onboarding link.
//
// TWO SUPPORTED SUBJECTS, one function:
//   { wholesaler_id }  → wholesaler_profiles.stripe_connect_id   (supplier payouts)
//   { partner_id }     → dd_partner_profiles.stripe_connect_account_id (ambassadors)
// The partner path is unchanged; the wholesaler path is new and is what
// dd-stripe-connect-status / dd-release-reserves read.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const wholesalerId: string | undefined = body.wholesaler_id;
    const partnerId: string | undefined = body.partner_id;
    const returnBase: string =
      typeof body.return_base === "string" && body.return_base.startsWith("http")
        ? body.return_base
        : "https://dynastydirect.com";

    if (!wholesalerId && !partnerId) {
      throw new Error("wholesaler_id or partner_id required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripeKey =
      Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe key not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    let accountId: string | null = null;
    let refreshUrl: string;
    let returnUrl: string;

    if (wholesalerId) {
      // ── WHOLESALER (supplier payout account) ────────────────────────────
      const { data: ws, error } = await supabase
        .from("wholesaler_profiles")
        .select("id, email, company_name, stripe_connect_id")
        .eq("id", wholesalerId)
        .maybeSingle();
      if (error || !ws) throw new Error("wholesaler not found");

      accountId = (ws.stripe_connect_id as string | null) ?? null;
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          email: ws.email ?? undefined,
          capabilities: { transfers: { requested: true } },
          business_profile: { name: ws.company_name ?? undefined },
          metadata: { dd_wholesaler_id: wholesalerId },
        });
        accountId = account.id;
        const { error: upErr } = await supabase
          .from("wholesaler_profiles")
          .update({
            stripe_connect_id: accountId,
            stripe_connect_updated_at: new Date().toISOString(),
          })
          .eq("id", wholesalerId);
        // A created-but-unrecorded account orphans real money later — fail loud.
        if (upErr) throw new Error(`connect id not saved: ${upErr.message}`);
      }
      refreshUrl = `${returnBase}/portal/wholesaler/payouts`;
      returnUrl = `${returnBase}/portal/wholesaler/payouts?onboarded=true`;
    } else {
      // ── PARTNER / AMBASSADOR (unchanged path) ───────────────────────────
      const { data: partner, error } = await supabase
        .from("dd_partner_profiles")
        .select("*")
        .eq("id", partnerId!)
        .maybeSingle();
      if (error || !partner) throw new Error("partner not found");

      accountId = partner.stripe_connect_account_id as string | null;
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          email: partner.email,
          capabilities: { transfers: { requested: true } },
          business_type: "individual",
          metadata: { dd_partner_id: partnerId! },
        });
        accountId = account.id;
        await supabase
          .from("dd_partner_profiles")
          .update({ stripe_connect_account_id: accountId })
          .eq("id", partnerId!);
      }
      refreshUrl = `${returnBase}/partner/settings`;
      returnUrl = `${returnBase}/partner/settings?onboarded=true`;
    }

    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({ url: link.url, account_id: accountId, subject: wholesalerId ? "wholesaler" : "partner" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
