/**
 * va-stripe-checkout
 *
 * Generates Stripe Checkout sessions for a VA invoice.
 *
 *   - payment_type === 'full'   → 1 session for the full amount
 *   - payment_type === 'split'  → 2 sessions: deposit (e.g. 50%) + final (remainder)
 *
 * The resulting hosted Checkout URLs are persisted on the invoice
 * (`deposit_payment_link`, `final_payment_link`, `payment_link`) so they can
 * be embedded in invoice emails / SMS and surfaced on the public PayInvoice
 * page. Marking the invoice paid is handled by `va-verify-payment` (called
 * from the Stripe success URL), so no webhook is required.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function siteOrigin(req: Request): string {
  const env = Deno.env.get("FRONTEND_BASE_URL");
  if (env) return env.replace(/\/$/, "");
  return req.headers.get("origin") || "https://gasmask-os-nexus.lovable.app";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } =
      await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { invoice_id } = (await req.json()) as { invoice_id?: string };
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error: invErr } = await supabase
      .from("va_invoices")
      .select("*")
      .eq("id", invoice_id)
      .eq("va_id", userId)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = siteOrigin(req);
    const total = Number(invoice.total || 0);
    if (!(total > 0)) {
      return new Response(JSON.stringify({ error: "Invoice total must be > 0" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentType: "full" | "split" =
      invoice.payment_type === "split" ? "split" : "full";
    const depositPercent = Math.min(
      Math.max(Number(invoice.deposit_percent || 50), 1),
      99,
    );

    // Round to 2 decimals
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const depositAmount = round2((total * depositPercent) / 100);
    const finalAmount = round2(total - depositAmount);

    const customerEmail = invoice.customer_email || undefined;
    const productLabel = invoice.service_type
      ? `${invoice.service_type} — ${invoice.customer_name}`
      : `Invoice ${invoice.invoice_number || ""} — ${invoice.customer_name}`;

    const buildSession = async (phase: "full" | "deposit" | "final", amount: number) => {
      const label =
        phase === "deposit"
          ? `${productLabel} (50% Deposit)`
          : phase === "final"
            ? `${productLabel} (Final Payment)`
            : productLabel;

      const successUrl =
        `${origin}/pay/${invoice.id}?paid=${phase}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/pay/${invoice.id}?cancelled=${phase}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: customerEmail,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: label },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          invoice_id: invoice.id,
          va_id: invoice.va_id ?? "",
          phase,
        },
      });

      return session;
    };

    const update: Record<string, unknown> = {
      payment_type: paymentType,
      deposit_percent: depositPercent,
      deposit_amount: paymentType === "split" ? depositAmount : null,
      final_amount: paymentType === "split" ? finalAmount : null,
    };

    if (paymentType === "full") {
      const session = await buildSession("full", total);
      update.full_session_id = session.id;
      update.payment_link = session.url;
      update.deposit_payment_link = null;
      update.final_payment_link = null;
    } else {
      const [depositSession, finalSession] = await Promise.all([
        buildSession("deposit", depositAmount),
        buildSession("final", finalAmount),
      ]);
      update.deposit_session_id = depositSession.id;
      update.final_session_id = finalSession.id;
      update.deposit_payment_link = depositSession.url;
      update.final_payment_link = finalSession.url;
      update.payment_link = depositSession.url; // primary CTA = deposit
    }

    const { error: updErr } = await supabase
      .from("va_invoices")
      .update(update)
      .eq("id", invoice.id);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        success: true,
        payment_type: paymentType,
        total,
        deposit_amount: depositAmount,
        final_amount: finalAmount,
        deposit_payment_link: update.deposit_payment_link ?? null,
        final_payment_link: update.final_payment_link ?? null,
        payment_link: update.payment_link ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[va-stripe-checkout] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
