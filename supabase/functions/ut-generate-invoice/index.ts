import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { sendEmail } from "../_shared/sendEmail.ts";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) return new Response(JSON.stringify({ error: "booking_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: booking } = await supabase.from("ut_bookings").select("*, ut_vendors(business_name)").eq("id", booking_id).single();
    if (!booking) throw new Error("Booking not found");

    const { data: customer } = await supabase.from("ut_profiles").select("*").eq("id", booking.customer_id).single();

    // Generate HTML invoice
    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
      <head><style>body{font-family:Arial;max-width:800px;margin:0 auto;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #ddd;text-align:left}.header{background:#1a1a2e;color:white;padding:30px;text-align:center}.total{font-size:1.2em;font-weight:bold}</style></head>
      <body>
        <div class="header"><h1 style="color:#e94560;margin:0;">Unforgettable Times</h1><p>Invoice #${booking.id.slice(0,8).toUpperCase()}</p></div>
        <div style="padding:20px;">
          <table>
            <tr><th>Customer</th><td>${customer?.full_name || "N/A"}</td><th>Date</th><td>${new Date().toLocaleDateString()}</td></tr>
            <tr><th>Email</th><td>${customer?.email || "N/A"}</td><th>Event Date</th><td>${booking.event_date || "N/A"}</td></tr>
          </table>
          <h3>Line Items</h3>
          <table>
            <thead><tr><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>${booking.ut_vendors?.business_name} — Event Service</td><td>$${booking.total_amount?.toFixed(2)}</td></tr>
              <tr><td>Platform Fee (15%)</td><td>$${booking.platform_fee?.toFixed(2)}</td></tr>
            </tbody>
            <tfoot><tr class="total"><td>Total Charged</td><td>$${booking.total_amount?.toFixed(2)}</td></tr></tfoot>
          </table>
          <p style="margin-top:20px;color:#666;">Payment Reference: ${booking.stripe_payment_intent_id || "N/A"}</p>
          <p style="color:#666;">Thank you for choosing Unforgettable Times!</p>
        </div>
      </body>
      </html>
    `;

    // Store invoice HTML in storage
    const fileName = `${booking.customer_id}/invoice-${booking.id.slice(0,8)}.html`;
    await supabase.storage.from("invoices").upload(fileName, new Blob([invoiceHtml], { type: "text/html" }), { upsert: true });

    // Email invoice to customer
    if (customer?.email) {
      await sendEmail({
        from: "Unforgettable Times <Sales@brandarodigital.com>",
        to: [customer.email],
        subject: `Invoice for your booking — ${booking.ut_vendors?.business_name}`,
        html: invoiceHtml,
      });
    }

    return new Response(JSON.stringify({ success: true, invoice_path: fileName }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-invoice error:", errText(error));
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
