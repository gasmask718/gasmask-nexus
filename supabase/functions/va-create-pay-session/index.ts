/**
 * va-create-pay-session
 *
 * Public endpoint that ALWAYS returns a fresh Stripe Checkout session URL for
 * a given invoice + phase. This prevents the "checkout has expired / you're all
 * done" error caused by Stripe Checkout sessions expiring after 24 hours.
 *
 * Body: { invoice_id: string, phase: 'full' | 'deposit' | 'final' }
 * Returns: { url: string }
 *
 * No JWT required — customers click this from a public /pay/:id page.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const { invoice_id, phase = "full" } = (await req.json()) as {
      invoice_id?: string;
      phase?: "full" | "deposit" | "final";
    };
    if (!invoice_id) throw new Error("invoice_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invoice, error } = await supabase
      .from("va_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();
    if (error || !invoice) throw new Error("Invoice not found");

    const total = Number(invoice.total || 0);
    if (!(total > 0)) throw new Error("Invoice total is zero");

    // Block already-paid phases
    if (invoice.status === "paid") throw new Error("Invoice already paid in full");
    if (phase === "deposit" && invoice.deposit_status === "paid") {
      throw new Error("Deposit already paid");
    }
    if (phase === "final" && invoice.final_status === "paid") {
      throw new Error("Final payment already received");
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const depositPercent = Math.min(Math.max(Number(invoice.deposit_percent || 50), 1), 99);
    const depositAmount = round2((total * depositPercent) / 100);
    const finalAmount = round2(total - depositAmount);

    const amount =
      phase === "deposit" ? depositAmount : phase === "final" ? finalAmount : total;
    if (!(amount > 0)) throw new Error("Computed amount is zero for this phase");

    const productLabel = invoice.service_type
      ? `${invoice.service_type} — ${invoice.customer_name}`
      : `Invoice ${invoice.invoice_number || ""} — ${invoice.customer_name}`;
    const label =
      phase === "deposit"
        ? `${productLabel} (Deposit)`
        : phase === "final"
          ? `${productLabel} (Final Payment)`
          : productLabel;

    const origin =
      Deno.env.get("PUBLIC_APP_ORIGIN") ||
      req.headers.get("origin") ||
      "https://gasmask-os-nexus.lovable.app";

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: invoice.customer_email || undefined,
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
      success_url: `${origin.replace(/\/$/, "")}/pay/${invoice.id}?paid=${phase}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.replace(/\/$/, "")}/pay/${invoice.id}?cancelled=${phase}`,
      metadata: {
        invoice_id: invoice.id,
        va_id: invoice.va_id ?? "",
        phase,
      },
    });

    // Persist the freshest session id + url so admins/UI can see it.
    const update: Record<string, unknown> = {};
    if (phase === "full") {
      update.full_session_id = session.id;
      update.payment_link = session.url;
    } else if (phase === "deposit") {
      update.deposit_session_id = session.id;
      update.deposit_payment_link = session.url;
    } else if (phase === "final") {
      update.final_session_id = session.id;
      update.final_payment_link = session.url;
    }
    await supabase.from("va_invoices").update(update).eq("id", invoice.id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
