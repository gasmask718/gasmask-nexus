// Dynasty Clipper Nation — pay out a clipper's approved earnings.
// Supports 3 payout methods: Stripe Connect transfer, Wise transfer, PayPal payout.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_PAYOUT_CENTS = 5000; // $50

const WISE_BASE = "https://api.sandbox.transferwise.com";
const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";

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

    // Admin/owner only — verify the caller's identity and role server-side.
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    const caller = userData?.user;
    if (userErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: callerRoles } = await (roleClient as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const isAdmin = (callerRoles || []).some((r: any) => r.role === "admin" || r.role === "owner");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin or owner role required to issue payouts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const body = await req.json();
    const clipper_id: string | undefined = body.clipper_id;
    const amount_cents: number | undefined = body.amount_cents;

    if (!clipper_id) throw new Error("clipper_id required");
    if (typeof amount_cents !== "number" || !Number.isFinite(amount_cents)) {
      throw new Error("amount_cents required (number)");
    }
    if (amount_cents < MIN_PAYOUT_CENTS) {
      throw new Error(`Minimum payout is $${MIN_PAYOUT_CENTS / 100}`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let transferId = "";

    // 1. Load clipper (all payout method fields)
    const { data: clipper, error: cErr } = await (supabase as any)
      .from("clipper_accounts")
      .select(
        "id, stripe_connect_id, stripe_connect_onboarded, payout_method, wise_account_id, wise_email, paypal_email, payoneer_email, payoneer_id, country, currency",
      )
      .eq("id", clipper_id)
      .maybeSingle();

    if (cErr || !clipper) throw new Error("Clipper not found");

    // 2. Verify balance
    const { data: earnings, error: eErr } = await (supabase as any)
      .from("clipper_earnings")
      .select("amount")
      .eq("clipper_id", clipper_id)
      .eq("status", "approved");

    if (eErr) throw eErr;
    const balanceDollars = (earnings ?? []).reduce(
      (s: number, r: any) => s + Number(r.amount || 0),
      0,
    );
    const balanceCents = Math.round(balanceDollars * 100);

    if (amount_cents > balanceCents) {
      throw new Error(
        `Insufficient balance. Available: $${(balanceCents / 100).toFixed(2)}`,
      );
    }

    const payoutMethod: string = clipper.payout_method ?? "stripe";

    // 3. Execute payout via chosen provider
    if (payoutMethod === "stripe") {
      if (!clipper.stripe_connect_id) throw new Error("Connect bank first");
      if (!clipper.stripe_connect_onboarded) {
        throw new Error("Clipper Stripe onboarding not complete");
      }

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

      const transfer = await stripe.transfers.create({
        amount: amount_cents,
        currency: "usd",
        destination: clipper.stripe_connect_id,
        metadata: {
          clipper_id,
          platform: "dynasty_clipper_nation",
        },
      });
      transferId = transfer.id;
    } else if (payoutMethod === "wise") {
      if (!clipper.wise_account_id && !clipper.wise_email) {
        throw new Error("Add Wise account first in portal settings");
      }

      const WISE_API_KEY = Deno.env.get("WISE_API_KEY");
      if (!WISE_API_KEY) {
        return new Response(
          JSON.stringify({
            error: "Wise not configured",
            message: "Add WISE_API_KEY to vault",
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Step 1: Get profile
      const profileRes = await fetch(`${WISE_BASE}/v1/profiles`, {
        headers: { Authorization: `Bearer ${WISE_API_KEY}` },
      });
      if (!profileRes.ok) {
        throw new Error(`Wise profiles error: ${await profileRes.text()}`);
      }
      const profiles = await profileRes.json();
      const profile = (profiles as any[]).find((p: any) => p.type === "personal");
      if (!profile) throw new Error("No Wise personal profile found");

      // Step 2: Create quote
      const quoteRes = await fetch(`${WISE_BASE}/v3/profiles/${profile.id}/quotes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WISE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceCurrency: "USD",
          targetCurrency: clipper.currency ?? "USD",
          sourceAmount: amount_cents / 100,
        }),
      });
      if (!quoteRes.ok) {
        throw new Error(`Wise quote error: ${await quoteRes.text()}`);
      }
      const quote = await quoteRes.json();

      // Step 3: Create transfer
      const transferRes = await fetch(`${WISE_BASE}/v1/transfers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WISE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetAccount: clipper.wise_account_id,
          quoteUuid: quote.id,
          customerTransactionId: crypto.randomUUID(),
          details: { reference: "Dynasty Clipper Nation payout" },
        }),
      });
      if (!transferRes.ok) {
        throw new Error(`Wise transfer error: ${await transferRes.text()}`);
      }
      const transfer = await transferRes.json();

      // Step 4: Fund the transfer
      const fundRes = await fetch(
        `${WISE_BASE}/v3/profiles/${profile.id}/transfers/${transfer.id}/payments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WISE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: "BALANCE" }),
        },
      );
      if (!fundRes.ok) {
        throw new Error(`Wise fund error: ${await fundRes.text()}`);
      }

      transferId = `wise_${transfer.id}`;
    } else if (payoutMethod === "paypal") {
      if (!clipper.paypal_email) {
        throw new Error("Add PayPal email first in portal settings");
      }

      const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
      const PAYPAL_SECRET = Deno.env.get("PAYPAL_SECRET");
      if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
        return new Response(
          JSON.stringify({ error: "PayPal not configured" }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Get access token
      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      if (!tokenRes.ok) {
        throw new Error(`PayPal auth error: ${await tokenRes.text()}`);
      }
      const { access_token } = await tokenRes.json();

      // Create payout
      const payoutRes = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender_batch_header: {
            sender_batch_id: crypto.randomUUID(),
            email_subject: "Dynasty Clipper Nation Payout",
            email_message: "Your earnings have been sent!",
          },
          items: [
            {
              recipient_type: "EMAIL",
              amount: {
                value: (amount_cents / 100).toFixed(2),
                currency: "USD",
              },
              receiver: clipper.paypal_email,
              note: "Clipper Nation earnings",
            },
          ],
        }),
      });
      if (!payoutRes.ok) {
        throw new Error(`PayPal payout error: ${await payoutRes.text()}`);
      }
      const paypalPayout = await payoutRes.json();
      transferId = `paypal_${paypalPayout.batch_header.payout_batch_id}`;
    } else if (payoutMethod === "payoneer") {
      const PAYONEER_USERNAME = Deno.env.get("PAYONEER_USERNAME");
      const PAYONEER_PASSWORD = Deno.env.get("PAYONEER_PASSWORD");
      const PAYONEER_PARTNER_ID = Deno.env.get("PAYONEER_PARTNER_ID");

      if (!PAYONEER_USERNAME || !PAYONEER_PASSWORD || !PAYONEER_PARTNER_ID) {
        return new Response(
          JSON.stringify({
            error: "Payoneer not configured",
            message:
              "Add PAYONEER_USERNAME, PAYONEER_PASSWORD, and PAYONEER_PARTNER_ID to vault",
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!clipper.payoneer_email && !clipper.payoneer_id) {
        throw new Error(
          "Add your Payoneer email or ID in portal settings first",
        );
      }

      // Payoneer Mass Payment API
      const payoneerRes = await fetch(
        `https://api.payoneer.com/v2/programs/${PAYONEER_PARTNER_ID}/payouts`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${PAYONEER_USERNAME}:${PAYONEER_PASSWORD}`)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_reference_id: crypto.randomUUID(),
            description: "Dynasty Clipper Nation payout",
            payee: {
              id: clipper.payoneer_id || clipper.payoneer_email,
              id_type: clipper.payoneer_id ? "PAYONEER_ID" : "EMAIL",
            },
            amount: {
              value: amount_cents / 100,
              currency: "USD",
            },
          }),
        },
      );

      if (!payoneerRes.ok) {
        const err = await payoneerRes.json().catch(() => ({}));
        throw new Error(
          `Payoneer error: ${err.message || err.description || "Unknown error"}`,
        );
      }
      const payoneerData = await payoneerRes.json();
      transferId = `payoneer_${payoneerData.payout_id || payoneerData.id || crypto.randomUUID()}`;
    } else {
      throw new Error(`Unknown payout_method: ${payoutMethod}`);
    }

    // 4. Record payout
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const { error: pErr } = await (supabase as any).from("clipper_payouts").insert({
      clipper_id,
      amount: amount_cents / 100,
      stripe_transfer_id: transferId,
      period_start: monthStart,
      period_end: today,
      status: "paid",
      paid_at: now.toISOString(),
    });
    if (pErr) throw pErr;

    // 5. Mark earnings as paid
    const { error: uErr } = await (supabase as any)
      .from("clipper_earnings")
      .update({ status: "paid" })
      .eq("clipper_id", clipper_id)
      .eq("status", "approved");
    if (uErr) throw uErr;

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transferId,
        payout_method: payoutMethod,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[clipper-payout] error", e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message) }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
