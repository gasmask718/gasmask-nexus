import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── SMS via Twilio ──────────────────────────────────────────────────────
async function sendSMS(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER") || "+18484004179";
  if (!sid || !token) return { success: false, error: "Missing Twilio credentials" };

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const data = await res.json();
  return res.ok ? { success: true, sid: data.sid } : { success: false, error: data.message };
}

// ── Email via SendGrid ──────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) return { success: false, error: "Missing SendGrid key" };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "bookings@toptierlifestyle.com", name: "TopTier Bookings" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  return res.ok ? { success: true } : { success: false, error: await res.text() };
}

// ── Build notification content ──────────────────────────────────────────
function buildSMS(booking: any) {
  return `🔔 New booking request:\n${booking.service_name}\n${booking.notes || "N/A"}\nDate: ${booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : "TBD"}\n\nReply:\n1 = Available\n2 = Not Available`;
}

function buildEmailHTML(booking: any, confirmUrl: string, declineUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
  .card { background: #fff; border-radius: 12px; padding: 30px; max-width: 600px; margin: 0 auto; }
  h1 { color: #1a1a1a; font-size: 22px; }
  .detail { background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .detail p { margin: 4px 0; color: #333; }
  .btn { display: inline-block; padding: 12px 28px; border-radius: 8px; color: #fff; text-decoration: none; font-weight: bold; margin-right: 12px; }
  .confirm { background: #10b981; }
  .decline { background: #ef4444; }
</style></head>
<body>
<div class="card">
  <h1>🔔 New Booking Request – TopTier</h1>
  <div class="detail">
    <p><strong>Service:</strong> ${booking.service_name}</p>
    <p><strong>Type:</strong> ${booking.service_type}</p>
    <p><strong>Client:</strong> ${booking.client_name}</p>
    <p><strong>Date:</strong> ${booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : "TBD"}</p>
    <p><strong>Price:</strong> $${booking.total_price}</p>
    ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ""}
  </div>
  <a href="${confirmUrl}" class="btn confirm">✅ Confirm</a>
  <a href="${declineUrl}" class="btn decline">❌ Decline</a>
</div>
</body>
</html>`;
}

function buildQuoteBroadcastSMS(booking: any) {
  return `🔔 TopTier quote request:\n${booking.service_name}\nDate: ${booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : "TBD"}\nClient: ${booking.client_name}\n\nSubmit your quote at toptierlifestyle.com`;
}

function buildQuoteBroadcastEmailHTML(booking: any) {
  return `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
  .card { background: #fff; border-radius: 12px; padding: 30px; max-width: 600px; margin: 0 auto; }
  h1 { color: #1a1a1a; font-size: 22px; }
  .detail { background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .detail p { margin: 4px 0; color: #333; }
</style></head>
<body>
<div class="card">
  <h1>📋 Quote Request – TopTier</h1>
  <p>A customer is looking for your services. Submit your best quote!</p>
  <div class="detail">
    <p><strong>Service:</strong> ${booking.service_name}</p>
    <p><strong>Type:</strong> ${booking.service_type}</p>
    <p><strong>Date:</strong> ${booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : "TBD"}</p>
    ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ""}
  </div>
  <p>Log into your TopTier partner dashboard to submit a quote.</p>
</div>
</body>
</html>`;
}

// ── Main Handler ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) throw new Error("booking_id required");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch booking
    const { data: booking, error: bErr } = await supabase
      .from("tt_bookings")
      .select("*")
      .eq("id", booking_id)
      .single();
    if (bErr || !booking) throw new Error("Booking not found: " + bErr?.message);

    const fulfillmentModel = booking.fulfillment_model || "request_confirm";
    const results: any = { model: fulfillmentModel, notifications: [] };

    if (fulfillmentModel === "request_confirm") {
      // ── REQUEST CONFIRM: notify ONE partner ──
      if (!booking.partner_id) throw new Error("request_confirm requires partner_id");

      const { data: partner } = await supabase
        .from("tt_partners")
        .select("*")
        .eq("id", booking.partner_id)
        .single();
      if (!partner) throw new Error("Partner not found");

      // Create confirmation request
      const { data: confirmReq } = await supabase
        .from("tt_confirmation_requests")
        .insert({
          booking_id: booking.id,
          partner_id: partner.id,
          status: "pending",
        })
        .select("id")
        .single();

      const baseUrl = Deno.env.get("FRONTEND_BASE_URL") || "https://gasmask-os-nexus.lovable.app";
      const confirmUrl = `${baseUrl}/partner/confirm?id=${confirmReq?.id}&action=confirm`;
      const declineUrl = `${baseUrl}/partner/confirm?id=${confirmReq?.id}&action=decline`;

      // Send SMS
      if (partner.phone) {
        const smsResult = await sendSMS(partner.phone, buildSMS(booking));
        results.notifications.push({ type: "sms", partner: partner.name, ...smsResult });
      }

      // Send Email
      if (partner.email) {
        const emailResult = await sendEmail(
          partner.email,
          `New Booking Request – TopTier | ${booking.service_name}`,
          buildEmailHTML(booking, confirmUrl, declineUrl)
        );
        results.notifications.push({ type: "email", partner: partner.name, ...emailResult });
      }

      // Log booking event
      await supabase.from("tt_booking_events").insert({
        booking_id: booking.id,
        event_type: "partner_notified",
        details: { partner_id: partner.id, partner_name: partner.name, method: "sms+email" },
      });

      // Update booking status
      await supabase
        .from("tt_bookings")
        .update({ status: "awaiting_partner", updated_at: new Date().toISOString() })
        .eq("id", booking.id);

    } else if (fulfillmentModel === "quote_broadcast") {
      // ── QUOTE BROADCAST: notify MULTIPLE partners ──
      const serviceCategory = booking.service_type || "transport";

      // Find eligible partners by category
      const { data: partners } = await supabase
        .from("tt_partners")
        .select("*")
        .eq("service_category", serviceCategory)
        .eq("status", "approved")
        .order("trust_score", { ascending: false })
        .limit(20);

      if (!partners || partners.length === 0) {
        results.warning = "No approved partners found for category: " + serviceCategory;
      } else {
        for (const partner of partners) {
          // Create broadcast quote entry (pending)
          await supabase.from("tt_broadcast_quotes").insert({
            booking_id: booking.id,
            partner_id: partner.id,
            quoted_price: 0,
            status: "submitted",
            message: null,
          });

          // SMS
          if (partner.phone) {
            const smsResult = await sendSMS(partner.phone, buildQuoteBroadcastSMS(booking));
            results.notifications.push({ type: "sms", partner: partner.name, ...smsResult });
          }

          // Email
          if (partner.email) {
            const emailResult = await sendEmail(
              partner.email,
              `Quote Request – TopTier | ${booking.service_name}`,
              buildQuoteBroadcastEmailHTML(booking)
            );
            results.notifications.push({ type: "email", partner: partner.name, ...emailResult });
          }
        }

        // Log event
        await supabase.from("tt_booking_events").insert({
          booking_id: booking.id,
          event_type: "quote_broadcast_sent",
          details: { partner_count: partners.length, categories: [serviceCategory] },
        });

        // Update booking status
        await supabase
          .from("tt_bookings")
          .update({ status: "collecting_quotes", updated_at: new Date().toISOString() })
          .eq("id", booking.id);
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("tt-booking-fulfillment error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
