import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { invoiceId, method, recipient } = await req.json();

    if (!invoiceId || !method || !recipient) {
      return new Response(
        JSON.stringify({ error: "invoiceId, method, and recipient are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get invoice
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("va_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentLink = invoice.payment_link || `${req.headers.get("origin") || "https://gasmask-os-nexus.lovable.app"}/pay/${invoiceId}`;

    if (method === "sms") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

      if (LOVABLE_API_KEY && TWILIO_API_KEY) {
        const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
        await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: recipient,
            From: "+17183089391",
            Body: `Invoice from Brandaro for $${invoice.total}. Pay here: ${paymentLink}`,
          }),
        });
      }
    }

    // Log the send
    await supabaseAdmin.from("va_invoice_logs").insert({
      invoice_id: invoiceId,
      sent_via: method,
      sent_to: recipient,
    });

    // Update invoice status
    await supabaseAdmin
      .from("va_invoices")
      .update({ status: "sent", payment_link: paymentLink })
      .eq("id", invoiceId);

    return new Response(
      JSON.stringify({ success: true, paymentLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
