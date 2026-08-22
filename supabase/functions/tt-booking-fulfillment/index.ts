import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSmsTemplate } from "../_shared/smsTemplates.ts";
import { sendSms } from "../_shared/sendSms.ts";
import { recordDispatchSuppressed } from "../_shared/dispatchOutcome.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── SMS via the canonical chokepoint (send-sms) ─────────────────────────
// Group D (workforce): approved/contracted partners receiving booking
// requests and quote broadcasts. Suppression-skipped sends are recorded as
// named outcomes (tt_notifications_log: dispatch_suppressed), not dropped.
async function sendPartnerSMS(supabase: any, booking: any, partner: any, body: string, idemKey: string) {
  const from = Deno.env.get("TWILIO_PHONE_NUMBER") || "+18484004179";
  const res = await sendSms({
    to: partner.phone,
    body,
    sendClass: "workforce",
    purpose: "tt_partner_offer",
    idempotencyKey: idemKey,
    from,
    skipCooldown: true,
    metadata: { booking_reference: booking.booking_reference },
  });
  if (res.blocked) {
    await recordDispatchSuppressed(supabase, {
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      recipientPhone: partner.phone,
      recipientName: partner.name || partner.business_name || null,
      partnerId: partner.id,
      sendClass: "workforce",
      reason: res.errorMessage || res.status,
    });
  }
  return res.success
    ? { success: true, sid: res.providerMessageId }
    : { success: false, blocked: res.blocked, status: res.status, error: res.errorMessage };
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

// ── REQUEST_CONFIRM templates ───────────────────────────────────────────
function buildRequestConfirmSMS(booking: any) {
  return buildSmsTemplate("partner_request_confirm", {
    service_name: booking.service_name,
    date: booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : "TBD",
    notes: booking.notes || undefined,
  });
}

function buildRequestConfirmEmailHTML(booking: any, confirmUrl: string, declineUrl: string) {
  return `<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;padding:20px}
  .card{background:#fff;border-radius:12px;padding:30px;max-width:600px;margin:0 auto}
  h1{color:#1a1a1a;font-size:22px}
  .detail{background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0}
  .detail p{margin:4px 0;color:#333}
  .btn{display:inline-block;padding:12px 28px;border-radius:8px;color:#fff;text-decoration:none;font-weight:bold;margin-right:12px}
  .confirm{background:#10b981}.decline{background:#ef4444}
</style></head><body><div class="card">
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
</div></body></html>`;
}

// ── COACH BUS QUOTE BROADCAST templates ─────────────────────────────────
function buildCoachBusSMS(booking: any) {
  const baseUrl = Deno.env.get("FRONTEND_BASE_URL") || "https://gasmask-os-nexus.lovable.app";
  return buildSmsTemplate("partner_quote_coach_bus", {
    pickup_city: booking.pickup_city || "TBD",
    dropoff_city: booking.dropoff_city || "TBD",
    date: booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : "TBD",
    passengers: booking.passenger_count || "TBD",
    quote_url: `${baseUrl}/partner/quote/${booking.id}`,
  });
}

function buildCoachBusEmailHTML(booking: any, quoteUrl: string) {
  const pickup = booking.pickup_city || "TBD";
  const dropoff = booking.dropoff_city || "TBD";
  const date = booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : "TBD";
  const time = booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleTimeString() : "TBD";
  const pax = booking.passenger_count || "TBD";
  const special = booking.special_requests || "None";

  return `<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;padding:20px}
  .card{background:#fff;border-radius:12px;padding:30px;max-width:600px;margin:0 auto}
  h1{color:#1a1a1a;font-size:22px}
  .route{background:linear-gradient(135deg,#1e3a5f,#2d5a8e);color:#fff;border-radius:10px;padding:20px;margin:16px 0;text-align:center}
  .route h2{margin:0;font-size:24px;letter-spacing:1px}
  .route .arrow{font-size:28px;margin:8px 0}
  .detail{background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0}
  .detail p{margin:6px 0;color:#333;font-size:14px}
  .detail strong{color:#1a1a1a}
  .btn-quote{display:inline-block;padding:14px 36px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin-top:16px}
  .footer{color:#888;font-size:12px;margin-top:24px;text-align:center}
</style></head><body><div class="card">
  <h1>🚌 Coach Bus Quote Request – TopTier</h1>
  <p>A customer needs coach bus transportation. Submit your best quote!</p>

  <div class="route">
    <h2>${pickup}</h2>
    <div class="arrow">↓</div>
    <h2>${dropoff}</h2>
  </div>

  <div class="detail">
    <p><strong>📅 Date:</strong> ${date}</p>
    <p><strong>🕐 Time:</strong> ${time}</p>
    <p><strong>👥 Passengers:</strong> ${pax}</p>
    <p><strong>📝 Special Requests:</strong> ${special}</p>
    ${booking.notes ? `<p><strong>💬 Notes:</strong> ${booking.notes}</p>` : ""}
  </div>

  <div style="text-align:center">
    <a href="${quoteUrl}" class="btn-quote">📋 Submit Your Quote</a>
  </div>

  <p class="footer">You're receiving this because you're a verified TopTier transportation partner.<br/>Reply within 24 hours for priority consideration.</p>
</div></body></html>`;
}

// ── Generic quote broadcast templates (jets, etc.) ──────────────────────
function buildGenericQuoteSMS(booking: any) {
  return buildSmsTemplate("partner_quote_request", {
    service_name: booking.service_name,
    date: booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : "TBD",
    quote_url: "https://toptierlifestyle.com/partner",
  });
}

function buildGenericQuoteEmailHTML(booking: any) {
  return `<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;padding:20px}
  .card{background:#fff;border-radius:12px;padding:30px;max-width:600px;margin:0 auto}
  h1{color:#1a1a1a;font-size:22px}
  .detail{background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0}
  .detail p{margin:4px 0;color:#333}
</style></head><body><div class="card">
  <h1>📋 Quote Request – TopTier</h1>
  <p>A customer is looking for your services. Submit your best quote!</p>
  <div class="detail">
    <p><strong>Service:</strong> ${booking.service_name}</p>
    <p><strong>Type:</strong> ${booking.service_type}</p>
    <p><strong>Date:</strong> ${booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : "TBD"}</p>
    ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ""}
  </div>
  <p>Log into your TopTier partner dashboard to submit a quote.</p>
</div></body></html>`;
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
    const baseUrl = Deno.env.get("FRONTEND_BASE_URL") || "https://gasmask-os-nexus.lovable.app";

    if (fulfillmentModel === "request_confirm") {
      // ── REQUEST CONFIRM: notify ONE partner ──
      if (!booking.partner_id) throw new Error("request_confirm requires partner_id");

      const { data: partner } = await supabase
        .from("tt_partners")
        .select("*")
        .eq("id", booking.partner_id)
        .single();
      if (!partner) throw new Error("Partner not found");

      const { data: confirmReq } = await supabase
        .from("tt_confirmation_requests")
        .insert({ booking_id: booking.id, partner_id: partner.id, status: "pending" })
        .select("id")
        .single();

      const confirmUrl = `${baseUrl}/partner/confirm?id=${confirmReq?.id}&action=confirm`;
      const declineUrl = `${baseUrl}/partner/confirm?id=${confirmReq?.id}&action=decline`;

      if (partner.phone) {
        const smsResult = await sendPartnerSMS(supabase, booking, partner, buildRequestConfirmSMS(booking), `tt-reqconfirm-${confirmReq?.id ?? booking.id}`);
        results.notifications.push({ type: "sms", partner: partner.name, ...smsResult });
      }
      if (partner.email) {
        const emailResult = await sendEmail(
          partner.email,
          `New Booking Request – TopTier | ${booking.service_name}`,
          buildRequestConfirmEmailHTML(booking, confirmUrl, declineUrl)
        );
        results.notifications.push({ type: "email", partner: partner.name, ...emailResult });
      }

      await supabase.from("tt_booking_events").insert({
        booking_id: booking.id,
        event_type: "partner_notified",
        details: { partner_id: partner.id, partner_name: partner.name, method: "sms+email" },
      });

      await supabase.from("tt_bookings")
        .update({ status: "awaiting_partner", updated_at: new Date().toISOString() })
        .eq("id", booking.id);

    } else if (fulfillmentModel === "quote_broadcast") {
      // ── QUOTE BROADCAST: notify MULTIPLE partners ──
      const isCoachBus = (booking.service_type === "coach_bus");
      const serviceCategory = booking.service_type || "transport";

      // Build partner query – match by category + location
      let partnerQuery = supabase
        .from("tt_partners")
        .select("*")
        .eq("service_category", serviceCategory)
        .eq("status", "approved")
        .order("trust_score", { ascending: false })
        .limit(30);

      // City/state match for coach bus
      if (isCoachBus && booking.pickup_city) {
        // Get partners in pickup city/state first, then expand
        const { data: localPartners } = await supabase
          .from("tt_partners")
          .select("*")
          .eq("service_category", serviceCategory)
          .eq("status", "approved")
          .or(`city.ilike.%${booking.pickup_city}%,city.ilike.%${booking.dropoff_city || ""}%`)
          .order("trust_score", { ascending: false })
          .limit(20);

        // Also get statewide partners
        const { data: statePartners } = await supabase
          .from("tt_partners")
          .select("*")
          .eq("service_category", serviceCategory)
          .eq("status", "approved")
          .order("trust_score", { ascending: false })
          .limit(30);

        // Merge: local first, then statewide (deduplicated)
        const seenIds = new Set<string>();
        const allPartners: any[] = [];
        for (const p of [...(localPartners || []), ...(statePartners || [])]) {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            allPartners.push(p);
          }
        }

        if (allPartners.length === 0) {
          results.warning = `No approved partners found for category: ${serviceCategory}`;
        } else {
          const quoteUrl = `${baseUrl}/partner/quote/${booking.id}`;

          for (const partner of allPartners) {
            await supabase.from("tt_broadcast_quotes").insert({
              booking_id: booking.id,
              partner_id: partner.id,
              quoted_price: 0,
              status: "pending",
              availability: "pending",
            });

            if (partner.phone) {
              const smsResult = await sendPartnerSMS(supabase, booking, partner, buildCoachBusSMS(booking), `tt-coach-quote-${booking.id}-${partner.id}`);
              results.notifications.push({ type: "sms", partner: partner.name, ...smsResult });
            }
            if (partner.email) {
              const emailResult = await sendEmail(
                partner.email,
                `🚌 Coach Bus Quote Request – ${booking.pickup_city || "Trip"} → ${booking.dropoff_city || "Destination"}`,
                buildCoachBusEmailHTML(booking, quoteUrl)
              );
              results.notifications.push({ type: "email", partner: partner.name, ...emailResult });
            }
          }

          await supabase.from("tt_booking_events").insert({
            booking_id: booking.id,
            event_type: "quote_broadcast_sent",
            details: {
              partner_count: allPartners.length,
              category: serviceCategory,
              pickup_city: booking.pickup_city,
              dropoff_city: booking.dropoff_city,
              passenger_count: booking.passenger_count,
            },
          });

          await supabase.from("tt_bookings")
            .update({ status: "dispatched", updated_at: new Date().toISOString() })
            .eq("id", booking.id);
        }
      } else {
        // Generic quote broadcast (private jets, etc.)
        const { data: partners } = partnerQuery;

        if (!partners || partners.length === 0) {
          results.warning = "No approved partners found for category: " + serviceCategory;
        } else {
          for (const partner of partners) {
            await supabase.from("tt_broadcast_quotes").insert({
              booking_id: booking.id,
              partner_id: partner.id,
              quoted_price: 0,
              status: "pending",
              availability: "pending",
            });

            if (partner.phone) {
              const smsResult = await sendPartnerSMS(supabase, booking, partner, buildGenericQuoteSMS(booking), `tt-quote-${booking.id}-${partner.id}`);
              results.notifications.push({ type: "sms", partner: partner.name, ...smsResult });
            }
            if (partner.email) {
              const emailResult = await sendEmail(
                partner.email,
                `Quote Request – TopTier | ${booking.service_name}`,
                buildGenericQuoteEmailHTML(booking)
              );
              results.notifications.push({ type: "email", partner: partner.name, ...emailResult });
            }
          }

          await supabase.from("tt_booking_events").insert({
            booking_id: booking.id,
            event_type: "quote_broadcast_sent",
            details: { partner_count: partners.length, categories: [serviceCategory] },
          });

          await supabase.from("tt_bookings")
            .update({ status: "dispatched", updated_at: new Date().toISOString() })
            .eq("id", booking.id);
        }
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
