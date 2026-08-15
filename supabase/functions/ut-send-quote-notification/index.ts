import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { sendEmail } from "../_shared/sendEmail.ts";
import { errText } from "../_shared/errText.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { quote_request_id } = await req.json();
    if (!quote_request_id) return new Response(JSON.stringify({ error: "quote_request_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: quote, error } = await supabase.from("ut_quote_requests").select("*, ut_vendors(business_name, owner_id)").eq("id", quote_request_id).single();
    if (error || !quote) throw new Error("Quote request not found");

    const { data: vendorProfile } = await supabase.from("ut_profiles").select("email").eq("id", quote.ut_vendors.owner_id).single();
    const vendorEmail = vendorProfile?.email;
    if (!vendorEmail) throw new Error("Vendor email not found");

    const result = await sendEmail({
      from: "Unforgettable Times <Sales@brandarodigital.com>",
      to: [vendorEmail],
      subject: `New quote request for ${quote.event_date || "upcoming event"}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a1a2e;padding:20px;text-align:center;">
            <h1 style="color:#e94560;margin:0;">Unforgettable Times</h1>
          </div>
          <div style="padding:20px;background:#f5f5f5;">
            <h2>New Quote Request</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px;font-weight:bold;">Customer</td><td style="padding:8px;">${quote.customer_name || "N/A"}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Event Type</td><td style="padding:8px;">${quote.event_type || "N/A"}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${quote.event_date || "TBD"}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Guests</td><td style="padding:8px;">${quote.guest_count || "N/A"}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Budget</td><td style="padding:8px;">$${quote.budget || "Flexible"}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Message</td><td style="padding:8px;">${quote.message || "No message"}</td></tr>
            </table>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://unforgettabletimes.com/vendor/quotes" style="background:#e94560;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;">Respond to Quote</a>
            </div>
          </div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true, message_id: result.messageId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("send-quote-notification error:", errText(error));
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
