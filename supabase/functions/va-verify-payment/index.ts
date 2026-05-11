/**
 * va-verify-payment
 *
 * Public endpoint hit by Stripe's success_url. Verifies the Checkout
 * session is paid and marks the corresponding phase on the invoice
 * (deposit / final / full). No webhook required.
 *
 * Body: { invoice_id, session_id, phase: 'full' | 'deposit' | 'final' }
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const { invoice_id, session_id, phase } = (await req.json()) as {
      invoice_id?: string;
      session_id?: string;
      phase?: "full" | "deposit" | "final";
    };

    if (!invoice_id || !session_id || !phase) {
      return new Response(
        JSON.stringify({ error: "invoice_id, session_id, phase required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    const paid =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invoice, error: invErr } = await supabase
      .from("va_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cross-check the session belongs to this invoice
    const expectedSessionId =
      phase === "deposit"
        ? invoice.deposit_session_id
        : phase === "final"
          ? invoice.final_session_id
          : invoice.full_session_id;
    if (expectedSessionId && expectedSessionId !== session_id) {
      return new Response(JSON.stringify({ error: "Session/invoice mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paid) {
      return new Response(
        JSON.stringify({ paid: false, payment_status: session.payment_status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {};
    let amountAdded = 0;

    if (phase === "full") {
      if (invoice.status !== "paid") {
        update.status = "paid";
        update.amount_paid = Number(invoice.total || 0);
        amountAdded = Number(invoice.total || 0);
      }
    } else if (phase === "deposit") {
      if (invoice.deposit_status !== "paid") {
        update.deposit_status = "paid";
        update.deposit_paid_at = nowIso;
        amountAdded = Number(invoice.deposit_amount || 0);
      }
    } else if (phase === "final") {
      if (invoice.final_status !== "paid") {
        update.final_status = "paid";
        update.final_paid_at = nowIso;
        amountAdded = Number(invoice.final_amount || 0);
      }
    }

    if (amountAdded > 0) {
      update.amount_paid = Number(invoice.amount_paid || 0) + amountAdded;
    }

    // Mark fully paid when both phases complete
    const newDepositStatus =
      (update.deposit_status as string) || invoice.deposit_status;
    const newFinalStatus =
      (update.final_status as string) || invoice.final_status;
    if (
      invoice.payment_type === "split" &&
      newDepositStatus === "paid" &&
      newFinalStatus === "paid"
    ) {
      update.status = "paid";
    } else if (
      invoice.payment_type === "split" &&
      newDepositStatus === "paid" &&
      invoice.status !== "paid"
    ) {
      update.status = "partially_paid";
    }

    if (Object.keys(update).length > 0) {
      const { error: updErr } = await supabase
        .from("va_invoices")
        .update(update)
        .eq("id", invoice_id);
      if (updErr) throw updErr;
    }

    return new Response(
      JSON.stringify({ paid: true, phase, applied: amountAdded }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[va-verify-payment] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
