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
async function sendSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
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
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) return { success: false, error: "Missing SendGrid key" };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "bookings@toptierlifestyle.com", name: "TopTier Transportation" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  return res.ok ? { success: true } : { success: false, error: await res.text() };
}

// ── Log communication ───────────────────────────────────────────────────
async function logComm(
  supabase: any, requestId: string, partnerId: string | null,
  direction: string, channel: string, template: string,
  preview: string, status: string, externalId?: string
) {
  await supabase.from("cb_communication_logs").insert({
    booking_request_id: requestId,
    partner_id: partnerId,
    direction, channel, template_used: template,
    content_preview: preview.substring(0, 300),
    delivery_status: status,
    external_message_id: externalId,
    sent_at: new Date().toISOString(),
  });
}

// ── SMS template ────────────────────────────────────────────────────────
function buildDispatchSMS(req: any, responseUrl: string) {
  return [
    `🚌 New Coach Bus Request:`,
    `${req.pickup_city || "TBD"} → ${req.dropoff_city || "TBD"}`,
    `${req.trip_date || "TBD"} ${req.trip_time || ""}`,
    `Passengers: ${req.passenger_count || "TBD"}`,
    `Type: ${req.trip_type || "one_way"}`,
    req.bus_type_preference ? `Preference: ${req.bus_type_preference}` : "",
    ``,
    `Submit quote: ${responseUrl}`,
  ].filter(Boolean).join("\n");
}

// ── Email template ──────────────────────────────────────────────────────
function buildDispatchEmail(req: any, responseUrl: string) {
  const amenities = req.requested_amenities?.length
    ? req.requested_amenities.map((a: string) => `<li>${a}</li>`).join("")
    : "<li>None specified</li>";

  return `<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0}
  .card{background:#fff;border-radius:12px;padding:30px;max-width:640px;margin:0 auto}
  h1{color:#1a1a1a;font-size:22px;margin-bottom:4px}
  .subtitle{color:#666;font-size:14px;margin-bottom:20px}
  .route{background:linear-gradient(135deg,#1e3a5f,#2d5a8e);color:#fff;border-radius:10px;padding:20px;text-align:center;margin:16px 0}
  .route h2{margin:0;font-size:22px;letter-spacing:1px}
  .route .arrow{font-size:28px;margin:6px 0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
  .cell{background:#f9f9f9;border-radius:8px;padding:12px}
  .cell .label{font-size:11px;color:#888;text-transform:uppercase;margin-bottom:4px}
  .cell .value{font-size:15px;color:#1a1a1a;font-weight:600}
  .amenities{background:#f0fdf4;border-radius:8px;padding:14px;margin:12px 0}
  .amenities h3{margin:0 0 8px;font-size:14px;color:#166534}
  .amenities ul{margin:0;padding-left:18px;color:#333}
  .notes{background:#fffbeb;border-radius:8px;padding:14px;margin:12px 0}
  .notes h3{margin:0 0 6px;font-size:14px;color:#92400e}
  .notes p{margin:0;color:#78350f;font-size:13px}
  .cta{text-align:center;margin:24px 0}
  .btn{display:inline-block;padding:14px 40px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px}
  .footer{text-align:center;color:#999;font-size:11px;margin-top:20px}
</style></head><body><div class="card">
  <h1>🚌 Coach Bus Quote Request</h1>
  <p class="subtitle">A customer needs transportation — submit your best quote!</p>

  <div class="route">
    <h2>${req.pickup_city || "TBD"}${req.pickup_state ? `, ${req.pickup_state}` : ""}</h2>
    <div class="arrow">↓</div>
    <h2>${req.dropoff_city || "TBD"}${req.dropoff_state ? `, ${req.dropoff_state}` : ""}</h2>
  </div>

  <div class="grid">
    <div class="cell"><div class="label">📅 Trip Date</div><div class="value">${req.trip_date || "TBD"}</div></div>
    <div class="cell"><div class="label">🕐 Time</div><div class="value">${req.trip_time || "TBD"}</div></div>
    <div class="cell"><div class="label">👥 Passengers</div><div class="value">${req.passenger_count || "TBD"}</div></div>
    <div class="cell"><div class="label">🔄 Trip Type</div><div class="value">${req.trip_type || "One Way"}</div></div>
    ${req.return_date ? `<div class="cell"><div class="label">📅 Return Date</div><div class="value">${req.return_date}</div></div>` : ""}
    ${req.bus_type_preference ? `<div class="cell"><div class="label">🚌 Bus Preference</div><div class="value">${req.bus_type_preference}</div></div>` : ""}
  </div>

  <div class="amenities">
    <h3>✅ Requested Amenities</h3>
    <ul>${amenities}</ul>
  </div>

  ${req.special_requests ? `<div class="notes"><h3>📝 Special Requests</h3><p>${req.special_requests}</p></div>` : ""}
  ${req.notes ? `<div class="notes"><h3>💬 Additional Notes</h3><p>${req.notes}</p></div>` : ""}

  <div class="cta">
    <a href="${responseUrl}" class="btn">📋 Submit Your Quote</a>
  </div>

  <p class="footer">You're receiving this as a verified TopTier transportation partner.<br/>Please respond within 24 hours for priority consideration.</p>
</div></body></html>`;
}

// ── Customer offer email ────────────────────────────────────────────────
function buildCustomerOfferEmail(req: any, quote: any, margin: any, approveUrl: string) {
  return `<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0}
  .card{background:#fff;border-radius:12px;padding:30px;max-width:600px;margin:0 auto}
  h1{color:#1a1a1a;font-size:24px}
  .route{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border-radius:10px;padding:20px;text-align:center;margin:16px 0}
  .route h2{margin:0;font-size:20px}
  .route .arrow{font-size:24px;margin:6px 0}
  .detail{background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0}
  .detail p{margin:6px 0;color:#333;font-size:14px}
  .price{text-align:center;margin:20px 0}
  .price .amount{font-size:36px;font-weight:bold;color:#10b981}
  .price .label{font-size:13px;color:#666}
  .btn{display:inline-block;padding:14px 40px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px}
  .footer{text-align:center;color:#999;font-size:11px;margin-top:20px}
</style></head><body><div class="card">
  <h1>🚌 Your Coach Bus Is Available!</h1>

  <div class="route">
    <h2>${req.pickup_city} → ${req.dropoff_city}</h2>
  </div>

  <div class="detail">
    <p><strong>📅 Date:</strong> ${req.trip_date || "TBD"}</p>
    <p><strong>👥 Passengers:</strong> ${req.passenger_count}</p>
    ${quote.vehicle_type ? `<p><strong>🚌 Vehicle:</strong> ${quote.vehicle_type}</p>` : ""}
    ${quote.capacity ? `<p><strong>💺 Capacity:</strong> ${quote.capacity} seats</p>` : ""}
    ${quote.amenities?.length ? `<p><strong>✅ Amenities:</strong> ${quote.amenities.join(", ")}</p>` : ""}
  </div>

  <div class="price">
    <div class="label">Total Price</div>
    <div class="amount">$${margin.final_customer_price.toLocaleString()}</div>
    ${quote.deposit_required > 0 ? `<div class="label">Deposit: $${quote.deposit_required}</div>` : ""}
  </div>

  <div style="text-align:center">
    <a href="${approveUrl}" class="btn">✅ Confirm Booking</a>
  </div>

  <p class="footer">This quote is valid for 48 hours. TopTier Lifestyle Transportation.</p>
</div></body></html>`;
}

// ── ACTIONS ─────────────────────────────────────────────────────────────

type Action = "dispatch" | "select_quote" | "send_customer_offer" | "submit_quote" | "kpis" | "recommend";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const action: Action = body.action;
    if (!action) throw new Error("action required");

    const supabase = createClient(supabaseUrl, serviceKey);
    const baseUrl = Deno.env.get("FRONTEND_BASE_URL") || "https://gasmask-os-nexus.lovable.app";

    // ── DISPATCH ────────────────────────────────────────────────────
    if (action === "dispatch") {
      const { request_id } = body;
      if (!request_id) throw new Error("request_id required");

      const { data: request, error: rErr } = await supabase
        .from("cb_booking_requests").select("*").eq("id", request_id).single();
      if (rErr || !request) throw new Error("Request not found: " + rErr?.message);

      // Load config
      const { data: config } = await supabase
        .from("cb_dispatch_config").select("*").eq("category", "coach_bus").single();
      const maxPartners = config?.max_partners_per_request || 20;

      // Match partners: exact city → same state → all approved coach_bus
      const { data: cityPartners } = await supabase
        .from("tt_partners").select("*")
        .eq("service_category", "coach_bus").eq("status", "approved")
        .or(`city.ilike.%${request.pickup_city}%,city.ilike.%${request.dropoff_city}%`)
        .order("trust_score", { ascending: false }).limit(maxPartners);

      const { data: statePartners } = await supabase
        .from("tt_partners").select("*")
        .eq("service_category", "coach_bus").eq("status", "approved")
        .or(`state.ilike.%${request.pickup_state || ""}%,state.ilike.%${request.dropoff_state || ""}%`)
        .order("trust_score", { ascending: false }).limit(maxPartners);

      const { data: allPartners } = await supabase
        .from("tt_partners").select("*")
        .eq("service_category", "coach_bus").eq("status", "approved")
        .order("trust_score", { ascending: false }).limit(maxPartners);

      // Merge & deduplicate (local priority)
      const seen = new Set<string>();
      const partners: any[] = [];
      for (const p of [...(cityPartners || []), ...(statePartners || []), ...(allPartners || [])]) {
        if (!seen.has(p.id) && partners.length < maxPartners) {
          seen.add(p.id);
          partners.push(p);
        }
      }

      if (partners.length === 0) {
        return json({ success: true, warning: "No approved coach_bus partners found", dispatched: 0 });
      }

      const notifications: any[] = [];
      const startTime = Date.now();

      for (const partner of partners) {
        // Generate secure response token
        const secureToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        await supabase.from("cb_partner_response_tokens").insert({
          booking_request_id: request.id,
          partner_id: partner.id,
          secure_token: secureToken,
          expires_at: expiresAt,
        });

        const responseUrl = `${baseUrl}/partner/respond/${secureToken}`;

        // Create dispatch record
        const { data: dispatch } = await supabase
          .from("cb_request_partner_dispatches")
          .insert({
            booking_request_id: request.id,
            partner_id: partner.id,
            partner_name: partner.name,
            partner_phone: partner.phone,
            partner_email: partner.email,
            channel: partner.phone && partner.email ? "sms+email" : partner.phone ? "sms" : "email",
            dispatch_payload: {
              pickup: request.pickup_city,
              dropoff: request.dropoff_city,
              date: request.trip_date,
              passengers: request.passenger_count,
              trip_type: request.trip_type,
            },
            status: "queued",
          })
          .select("id, response_token").single();

        // SMS
        if (partner.phone) {
          const smsBody = buildDispatchSMS(request, responseUrl);
          const smsResult = await sendSMS(partner.phone, smsBody);
          notifications.push({ type: "sms", partner: partner.name, ...smsResult });

          await logComm(supabase, request.id, partner.id, "outbound", "sms",
            "cb_dispatch_sms", smsBody, smsResult.success ? "sent" : "failed", smsResult.sid);

          if (dispatch) {
            await supabase.from("cb_request_partner_dispatches")
              .update({ status: smsResult.success ? "sent" : "failed", sent_at: new Date().toISOString(),
                failure_reason: smsResult.error || null })
              .eq("id", dispatch.id);
          }
        }

        // Email
        if (partner.email) {
          const emailHtml = buildDispatchEmail(request, responseUrl);
          const emailResult = await sendEmail(
            partner.email,
            `🚌 Coach Bus Quote Request – ${request.pickup_city} → ${request.dropoff_city}`,
            emailHtml
          );
          notifications.push({ type: "email", partner: partner.name, ...emailResult });

          await logComm(supabase, request.id, partner.id, "outbound", "email",
            "cb_dispatch_email", `Quote request: ${request.pickup_city} → ${request.dropoff_city}`,
            emailResult.success ? "sent" : "failed");

          if (dispatch && !partner.phone) {
            await supabase.from("cb_request_partner_dispatches")
              .update({ status: emailResult.success ? "sent" : "failed", sent_at: new Date().toISOString(),
                failure_reason: emailResult.error || null })
              .eq("id", dispatch.id);
          }
        }
      }

      // Update request status
      await supabase.from("cb_booking_requests")
        .update({ status: "awaiting_quotes", updated_at: new Date().toISOString() })
        .eq("id", request.id);

      return json({
        success: true,
        dispatched: partners.length,
        notifications,
        elapsed_ms: Date.now() - startTime,
      });
    }

    // ── SUBMIT QUOTE (partner response) ─────────────────────────────
    if (action === "submit_quote") {
      const { request_id, partner_id, quoted_price, vehicle_type, capacity,
        amenities, availability_status, alternate_offer_notes, quote_notes,
        deposit_required, response_method } = body;
      if (!request_id || !partner_id || quoted_price === undefined)
        throw new Error("request_id, partner_id, and quoted_price required");

      // Find dispatch record to calculate response time
      const { data: dispatch } = await supabase
        .from("cb_request_partner_dispatches")
        .select("id, sent_at")
        .eq("booking_request_id", request_id).eq("partner_id", partner_id)
        .single();

      const responseTimeSec = dispatch?.sent_at
        ? Math.round((Date.now() - new Date(dispatch.sent_at).getTime()) / 1000) : null;

      // Insert quote (triggers auto-margin calculation)
      const { data: quote, error: qErr } = await supabase
        .from("cb_partner_quotes")
        .insert({
          booking_request_id: request_id,
          partner_id,
          dispatch_id: dispatch?.id,
          quoted_price,
          vehicle_type: vehicle_type || null,
          capacity: capacity || null,
          amenities: amenities || null,
          availability_status: availability_status || "quoted",
          alternate_offer_notes: alternate_offer_notes || null,
          quote_notes: quote_notes || null,
          deposit_required: deposit_required || 0,
          response_method: response_method || "dashboard",
          response_time_seconds: responseTimeSec,
        })
        .select("id").single();
      if (qErr) throw new Error("Failed to insert quote: " + qErr.message);

      // Update dispatch status
      if (dispatch) {
        await supabase.from("cb_request_partner_dispatches")
          .update({ status: "responded", responded_at: new Date().toISOString() })
          .eq("id", dispatch.id);
      }

      return json({ success: true, quote_id: quote?.id, response_time_seconds: responseTimeSec });
    }

    // ── SELECT QUOTE (admin picks winner) ───────────────────────────
    if (action === "select_quote") {
      const { request_id, quote_id, reason, selected_by, backup_quote_ids } = body;
      if (!request_id || !quote_id) throw new Error("request_id and quote_id required");

      // Fetch quote + margin
      const { data: quote } = await supabase
        .from("cb_partner_quotes").select("*").eq("id", quote_id).single();
      if (!quote) throw new Error("Quote not found");

      const { data: margin } = await supabase
        .from("cb_quote_margins").select("*").eq("quote_id", quote_id).single();

      // Create selection event with snapshot
      await supabase.from("cb_quote_selection_events").insert({
        booking_request_id: request_id,
        selected_quote_id: quote_id,
        selected_partner_id: quote.partner_id,
        selection_reason: reason || "admin_selection",
        selected_by: selected_by || null,
        quote_snapshot: { quote, margin },
        backup_quote_ids: backup_quote_ids || null,
      });

      // Mark quote as selected
      await supabase.from("cb_partner_quotes")
        .update({ is_selected: true }).eq("id", quote_id);

      // Update request
      await supabase.from("cb_booking_requests")
        .update({
          status: "selected",
          selected_quote_id: quote_id,
          selected_partner_id: quote.partner_id,
          customer_offer_price: margin?.final_customer_price || quote.quoted_price,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request_id);

      return json({ success: true, selected_partner_id: quote.partner_id, customer_price: margin?.final_customer_price });
    }

    // ── SEND CUSTOMER OFFER ─────────────────────────────────────────
    if (action === "send_customer_offer") {
      const { request_id, channels } = body;
      if (!request_id) throw new Error("request_id required");

      const { data: request } = await supabase
        .from("cb_booking_requests").select("*").eq("id", request_id).single();
      if (!request) throw new Error("Request not found");
      if (!request.selected_quote_id) throw new Error("No quote selected yet");

      const { data: quote } = await supabase
        .from("cb_partner_quotes").select("*").eq("id", request.selected_quote_id).single();
      const { data: margin } = await supabase
        .from("cb_quote_margins").select("*").eq("quote_id", request.selected_quote_id).single();

      const approveUrl = `${baseUrl}/booking/approve/${request.id}`;
      const sendChannels = channels || ["sms", "email"];
      const results: any[] = [];

      if (sendChannels.includes("sms") && request.customer_phone) {
        const smsBody = `🚌 Your Coach Bus is Available!\n${request.pickup_city} → ${request.dropoff_city}\n${request.trip_date || "TBD"}\nPrice: $${margin?.final_customer_price || quote?.quoted_price}\n\nConfirm: ${approveUrl}`;
        const smsResult = await sendSMS(request.customer_phone, smsBody);
        results.push({ channel: "sms", ...smsResult });
        await logComm(supabase, request.id, null, "outbound", "sms", "cb_customer_offer_sms",
          smsBody, smsResult.success ? "sent" : "failed", smsResult.sid);
      }

      if (sendChannels.includes("email") && request.customer_email) {
        const html = buildCustomerOfferEmail(request, quote, margin, approveUrl);
        const emailResult = await sendEmail(
          request.customer_email,
          `🚌 Your Coach Bus Quote – ${request.pickup_city} → ${request.dropoff_city}`,
          html
        );
        results.push({ channel: "email", ...emailResult });
        await logComm(supabase, request.id, null, "outbound", "email", "cb_customer_offer_email",
          `Offer: $${margin?.final_customer_price}`, emailResult.success ? "sent" : "failed");
      }

      await supabase.from("cb_booking_requests")
        .update({ status: "customer_review", customer_offer_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", request.id);

      return json({ success: true, results });
    }

    // ── KPIs ────────────────────────────────────────────────────────
    if (action === "kpis") {
      const { data, error } = await supabase.rpc("cb_dispatch_kpis");
      if (error) throw new Error("KPI query failed: " + error.message);
      return json({ success: true, kpis: data });
    }

    // ── RECOMMEND ───────────────────────────────────────────────────
    if (action === "recommend") {
      const { request_id } = body;
      if (!request_id) throw new Error("request_id required");
      const { data, error } = await supabase.rpc("cb_recommend_quote", { p_request_id: request_id });
      if (error) throw new Error("Recommendation failed: " + error.message);

      // Auto-flag best recommendation on request
      if (data?.lowest_price?.quote_id) {
        await supabase.from("cb_booking_requests")
          .update({ recommended_quote_id: data.lowest_price.quote_id })
          .eq("id", request_id);
      }

      return json({ success: true, recommendations: data });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e: any) {
    console.error("cb-dispatch-engine error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
