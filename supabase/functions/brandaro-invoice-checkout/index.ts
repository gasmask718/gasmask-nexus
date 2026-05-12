/**
 * brandaro-invoice-checkout
 *
 * Generates a Stripe Checkout session for a Brandaro client invoice
 * (brandaro_client_invoices). The hosted checkout URL is persisted on
 * the invoice as `payment_link` so it can be copied / sent to the lead.
 * Funds settle into the Stripe account that owns STRIPE_SECRET_KEY.
 *
 * INPUT:  { invoice_id: string }
 * OUTPUT: { success, payment_link, stripe_session_id }
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { invoice_id } = (await req.json()) as { invoice_id?: string };
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error: invErr } = await supabase
      .from("brandaro_client_invoices")
      .select("*, brandaro_leads_master:lead_id(business_name, email, phone)")
      .eq("id", invoice_id)
      .single();
    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const total = Number(invoice.total || 0);
    if (!(total > 0)) {
      return new Response(JSON.stringify({ error: "Invoice total must be > 0" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lead = (invoice as any).brandaro_leads_master || {};
    const customerEmail: string | undefined = lead.email || undefined;
    const productLabel = `Invoice ${invoice.invoice_number} — ${lead.business_name || "Brandaro Client"}`;
    const currency = (invoice.currency || "USD").toLowerCase();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = siteOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency,
          product_data: { name: productLabel },
          unit_amount: Math.round(total * 100),
        },
        quantity: 1,
      }],
      success_url: `${origin}/crm/brandaro?invoice=${invoice.id}&paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/crm/brandaro?invoice=${invoice.id}&cancelled=1`,
      metadata: {
        invoice_id: invoice.id,
        lead_id: invoice.lead_id ?? "",
        source: "brandaro_client_invoice",
      },
    });

    const { error: updErr } = await supabase
      .from("brandaro_client_invoices")
      .update({
        payment_link: session.url,
        stripe_session_id: session.id,
        payment_link_created_at: new Date().toISOString(),
        status: invoice.status === "draft" ? "sent" : invoice.status,
      })
      .eq("id", invoice.id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({
      success: true,
      payment_link: session.url,
      stripe_session_id: session.id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[brandaro-invoice-checkout] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
