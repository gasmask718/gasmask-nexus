// Dynasty Direct — Stripe Connect webhook (account.updated).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const sig = req.headers.get("stripe-signature");
    const secret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET") ?? Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const body = await req.text();
    let event: Stripe.Event;
    if (sig && secret) {
      event = await stripe.webhooks.constructEventAsync(body, sig, secret);
    } else {
      event = JSON.parse(body);
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const charges_ok = account.charges_enabled && account.payouts_enabled;
      const ext = (account.external_accounts?.data?.[0] ?? null) as
        (Stripe.BankAccount | Stripe.Card | null);
      const last4 = (ext as { last4?: string } | null)?.last4 ?? null;
      const bank_name = (ext as { bank_name?: string } | null)?.bank_name ?? null;
      const payout_method = ext?.object ?? null;

      await supabase.from("dd_partner_profiles")
        .update({
          stripe_connect_onboarded: !!charges_ok,
          payout_method,
          payout_last4: last4,
          payout_bank_name: bank_name,
        })
        .eq("stripe_connect_account_id", account.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
