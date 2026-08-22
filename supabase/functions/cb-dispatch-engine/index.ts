import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms, type SendSmsClass } from "../_shared/sendSms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── SMS via send-sms (tt-* dispatch pattern) ────────────────────────────
// All outbound SMS routes through the send-sms chokepoint: suppression
// (dnc_list + opt_out_events + legal STOP), idempotency, and an
// outbound_messages audit row. A suppression-blocked send returns
// `suppressed: true` so the caller can log a named outcome instead of a
// silent skip — same silent-failure problem as tt-smart-dispatch.
async function sendSMS(
  to: string,
  body: string,
  opts: { sendClass: SendSmsClass; idempotencyKey: string; purpose: string; skipCooldown?: boolean },
): Promise<{ success: boolean; sid?: string; error?: string; suppressed?: boolean }> {
  const r = await sendSms({
    to,
    body,
    // Sender parity: previously TWILIO_PHONE_NUMBER || +18484004179.
    from: Deno.env.get("TWILIO_PHONE_NUMBER") || "+18484004179",
    sendClass: opts.sendClass,
    idempotencyKey: opts.idempotencyKey,
    skipCooldown: opts.skipCooldown ?? false,
    purpose: opts.purpose,
  });
  return {
    success: r.success,
    sid: r.providerMessageId ?? undefined,
    error: r.errorMessage ?? undefined,
    suppressed: r.blocked,
  };
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

// ── SMS templates ───────────────────────────────────────────────────────
function buildDispatchSMS(req: any, responseUrl: string) {
  if (req.category === "private_jet") {
    return [
      `✈️ New Private Jet Request:`,
      `${req.departure_airport || req.pickup_city || "TBD"} → ${req.arrival_airport || req.dropoff_city || "TBD"}`,
      `${req.trip_date || "TBD"} ${req.trip_time || ""}`,
      `Passengers: ${req.passenger_count || "TBD"}`,
      `Type: ${req.flight_type || "one_way"}`,
      req.aircraft_preference ? `Preference: ${req.aircraft_preference}` : "",
      ``,
      `Submit quote: ${responseUrl}`,
    ].filter(Boolean).join("\n");
  }
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

// ── Email templates ─────────────────────────────────────────────────────
function buildDispatchEmail(req: any, responseUrl: string) {
  const isJet = req.category === "private_jet";
  const icon = isJet ? "✈️" : "🚌";
  const title = isJet ? "Private Jet Charter Request" : "Coach Bus Quote Request";
  const subtitle = isJet
    ? "An exclusive charter request — submit your best quote!"
    : "A customer needs transportation — submit your best quote!";
  const gradient = isJet
    ? "linear-gradient(135deg,#1a1a2e,#16213e)"
    : "linear-gradient(135deg,#1e3a5f,#2d5a8e)";
  const fromCity = isJet ? (req.departure_airport || req.pickup_city || "TBD") : (req.pickup_city || "TBD");
  const toCity = isJet ? (req.arrival_airport || req.dropoff_city || "TBD") : (req.dropoff_city || "TBD");

  const amenities = req.requested_amenities?.length
    ? req.requested_amenities.map((a: string) => `<li>${a}</li>`).join("")
    : "<li>None specified</li>";

  const extraCells = isJet ? `
    ${req.aircraft_preference ? `<div class="cell"><div class="label">✈️ Aircraft Preference</div><div class="value">${req.aircraft_preference}</div></div>` : ""}
    ${req.luggage_estimate ? `<div class="cell"><div class="label">🧳 Luggage</div><div class="value">${req.luggage_estimate}</div></div>` : ""}
    ${req.catering_requests ? `<div class="cell"><div class="label">🍽️ Catering</div><div class="value">${req.catering_requests}</div></div>` : ""}
    ${req.pet_friendly ? `<div class="cell"><div class="label">🐾 Pets</div><div class="value">Yes</div></div>` : ""}
  ` : `
    ${req.return_date ? `<div class="cell"><div class="label">📅 Return Date</div><div class="value">${req.return_date}</div></div>` : ""}
    ${req.bus_type_preference ? `<div class="cell"><div class="label">🚌 Bus Preference</div><div class="value">${req.bus_type_preference}</div></div>` : ""}
  `;

  return `<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0}
  .card{background:#fff;border-radius:12px;padding:30px;max-width:640px;margin:0 auto}
  h1{color:#1a1a1a;font-size:22px;margin-bottom:4px}
  .subtitle{color:#666;font-size:14px;margin-bottom:20px}
  .route{background:${gradient};color:#fff;border-radius:10px;padding:20px;text-align:center;margin:16px 0}
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
  <h1>${icon} ${title}</h1>
  <p class="subtitle">${subtitle}</p>

  <div class="route">
    <h2>${fromCity}</h2>
    <div class="arrow">↓</div>
    <h2>${toCity}</h2>
  </div>

  <div class="grid">
    <div class="cell"><div class="label">📅 ${isJet ? "Departure" : "Trip"} Date</div><div class="value">${req.trip_date || "TBD"}</div></div>
    <div class="cell"><div class="label">🕐 Time</div><div class="value">${req.trip_time || "TBD"}</div></div>
    <div class="cell"><div class="label">👥 Passengers</div><div class="value">${req.passenger_count || "TBD"}</div></div>
    <div class="cell"><div class="label">🔄 ${isJet ? "Flight" : "Trip"} Type</div><div class="value">${isJet ? (req.flight_type || "One Way") : (req.trip_type || "One Way")}</div></div>
    ${extraCells}
  </div>

  ${!isJet ? `<div class="amenities"><h3>✅ Requested Amenities</h3><ul>${amenities}</ul></div>` : ""}

  ${req.special_requests ? `<div class="notes"><h3>📝 Special Requests</h3><p>${req.special_requests}</p></div>` : ""}
  ${req.notes ? `<div class="notes"><h3>💬 Additional Notes</h3><p>${req.notes}</p></div>` : ""}

  <div class="cta">
    <a href="${responseUrl}" class="btn">📋 Submit Your Quote</a>
  </div>

  <p class="footer">You're receiving this as a verified TopTier ${isJet ? "aviation" : "transportation"} partner.<br/>Please respond within 24 hours for priority consideration.</p>
</div></body></html>`;
}

// ── Customer offer email ────────────────────────────────────────────────
function buildCustomerOfferEmail(req: any, quote: any, margin: any, approveUrl: string) {
  const isJet = req.category === "private_jet";
  const icon = isJet ? "✈️" : "🚌";
  const title = isJet ? "Your Private Jet Charter Is Ready!" : "Your Coach Bus Is Available!";
  const gradient = isJet ? "linear-gradient(135deg,#1a1a2e,#c9a84c)" : "linear-gradient(135deg,#7c3aed,#a855f7)";
  const fromCity = isJet ? (req.departure_airport || req.pickup_city) : req.pickup_city;
  const toCity = isJet ? (req.arrival_airport || req.dropoff_city) : req.dropoff_city;

  const jetDetails = isJet ? `
    ${quote.aircraft_type ? `<p><strong>✈️ Aircraft:</strong> ${quote.aircraft_type}</p>` : ""}
    ${quote.flight_time_hours ? `<p><strong>🕐 Flight Time:</strong> ${quote.flight_time_hours}h</p>` : ""}
    ${quote.reposition_cost > 0 ? `<p><strong>📍 Reposition:</strong> Included</p>` : ""}
  ` : `
    ${quote.vehicle_type ? `<p><strong>🚌 Vehicle:</strong> ${quote.vehicle_type}</p>` : ""}
    ${quote.capacity ? `<p><strong>💺 Capacity:</strong> ${quote.capacity} seats</p>` : ""}
    ${quote.amenities?.length ? `<p><strong>✅ Amenities:</strong> ${quote.amenities.join(", ")}</p>` : ""}
  `;

  return `<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0}
  .card{background:#fff;border-radius:12px;padding:30px;max-width:600px;margin:0 auto}
  h1{color:#1a1a1a;font-size:24px}
  .route{background:${gradient};color:#fff;border-radius:10px;padding:20px;text-align:center;margin:16px 0}
  .route h2{margin:0;font-size:20px}
  .detail{background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0}
  .detail p{margin:6px 0;color:#333;font-size:14px}
  .price{text-align:center;margin:20px 0}
  .price .amount{font-size:36px;font-weight:bold;color:#10b981}
  .price .label{font-size:13px;color:#666}
  .btn{display:inline-block;padding:14px 40px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px}
  .footer{text-align:center;color:#999;font-size:11px;margin-top:20px}
</style></head><body><div class="card">
  <h1>${icon} ${title}</h1>

  <div class="route">
    <h2>${fromCity} → ${toCity}</h2>
  </div>

  <div class="detail">
    <p><strong>📅 Date:</strong> ${req.trip_date || "TBD"}</p>
    <p><strong>👥 Passengers:</strong> ${req.passenger_count}</p>
    ${jetDetails}
  </div>

  <div class="price">
    <div class="label">Total Price</div>
    <div class="amount">$${margin.final_customer_price.toLocaleString()}</div>
    ${quote.deposit_required > 0 ? `<div class="label">Deposit: $${quote.deposit_required}</div>` : ""}
  </div>

  <div style="text-align:center">
    <a href="${approveUrl}" class="btn">✅ Confirm ${isJet ? "Charter" : "Booking"}</a>
  </div>

  <p class="footer">This quote is valid for 48 hours. TopTier Lifestyle ${isJet ? "Aviation" : "Transportation"}.</p>
</div></body></html>`;
}

// ── ACTIONS ─────────────────────────────────────────────────────────────

type Action = "dispatch" | "select_quote" | "send_customer_offer" | "submit_quote" | "kpis" | "recommend" | "auto_evaluate";

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

      // Load config based on request category
      const category = request.category || "coach_bus";
      const { data: config } = await supabase
        .from("cb_dispatch_config").select("*").eq("category", category).single();
      const maxPartners = config?.max_partners_per_request || 20;

      // Match partners by category
      let partnerSources: any[][] = [];

      if (category === "private_jet") {
        // Private jet: global matching — all approved aviation partners
        const { data: allJetPartners } = await supabase
          .from("tt_partners").select("*")
          .eq("service_category", "private_jet").eq("status", "approved")
          .order("trust_score", { ascending: false }).limit(maxPartners);
        partnerSources = [allJetPartners || []];
      } else {
        // Coach bus: geographic matching (city → state → all)
        const { data: cityPartners } = await supabase
          .from("tt_partners").select("*")
          .eq("service_category", category).eq("status", "approved")
          .or(`city.ilike.%${request.pickup_city}%,city.ilike.%${request.dropoff_city}%`)
          .order("trust_score", { ascending: false }).limit(maxPartners);

        const { data: statePartners } = await supabase
          .from("tt_partners").select("*")
          .eq("service_category", category).eq("status", "approved")
          .or(`state.ilike.%${request.pickup_state || ""}%,state.ilike.%${request.dropoff_state || ""}%`)
          .order("trust_score", { ascending: false }).limit(maxPartners);

        const { data: allPartners } = await supabase
          .from("tt_partners").select("*")
          .eq("service_category", category).eq("status", "approved")
          .order("trust_score", { ascending: false }).limit(maxPartners);

        partnerSources = [cityPartners || [], statePartners || [], allPartners || []];
      }

      // Merge & deduplicate (local priority)
      const seen = new Set<string>();
      const partners: any[] = [];
      for (const source of partnerSources) {
        for (const p of source) {
          if (!seen.has(p.id) && partners.length < maxPartners) {
            seen.add(p.id);
            partners.push(p);
          }
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

    // ── AUTO EVALUATE ───────────────────────────────────────────────
    if (action === "auto_evaluate") {
      const { request_id, trigger_type } = body;
      if (!request_id) throw new Error("request_id required");

      const { data: request } = await supabase
        .from("cb_booking_requests").select("*").eq("id", request_id).single();
      if (!request) throw new Error("Request not found");

      // Fetch all valid quotes
      const { data: quotes } = await supabase
        .from("cb_partner_quotes").select("*")
        .eq("booking_request_id", request_id)
        .in("availability_status", ["quoted", "alternate_offer"]);

      if (!quotes || quotes.length === 0) {
        return json({ success: false, error: "No quotes available for evaluation" });
      }

      // Fetch partner metadata for rating scores
      const partnerIds = [...new Set(quotes.map((q: any) => q.partner_id))];
      const { data: partners } = await supabase
        .from("tt_partners").select("id, trust_score, rating")
        .in("id", partnerIds);
      const partnerMap = new Map((partners || []).map((p: any) => [p.id, p]));

      // Scoring weights
      const weights = { price: 0.4, speed: 0.2, rating: 0.2, capacity: 0.1, availability: 0.1 };

      // Compute min/max for normalization
      const prices = quotes.map((q: any) => q.quoted_price).filter(Boolean);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice || 1;

      const speeds = quotes.map((q: any) => q.response_time_seconds).filter(Boolean);
      const minSpeed = Math.min(...speeds.length ? speeds : [0]);
      const maxSpeed = Math.max(...speeds.length ? speeds : [1]);
      const speedRange = maxSpeed - minSpeed || 1;

      const requestedCapacity = request.passenger_count || 40;

      // Score each quote
      const scored = quotes.map((q: any) => {
        const partner = partnerMap.get(q.partner_id) || {};

        // Price: lower is better (invert normalized)
        const priceScore = prices.length > 1
          ? 1 - ((q.quoted_price - minPrice) / priceRange)
          : 1;

        // Speed: faster is better (invert normalized)
        const speedScore = q.response_time_seconds != null && speeds.length > 1
          ? 1 - ((q.response_time_seconds - minSpeed) / speedRange)
          : q.response_time_seconds != null ? 0.8 : 0.5;

        // Rating: normalized 0-1 from trust_score (0-100) or rating (0-5)
        const ratingScore = partner.trust_score
          ? Math.min(partner.trust_score / 100, 1)
          : partner.rating ? partner.rating / 5 : 0.5;

        // Capacity fit: how well capacity matches requested
        const capacityScore = q.capacity
          ? q.capacity >= requestedCapacity
            ? Math.min(1, requestedCapacity / q.capacity + 0.2) // slight penalty for oversized
            : q.capacity / requestedCapacity // penalty for undersized
          : 0.5;

        // Availability: quoted = 1, alternate_offer = 0.6
        const availabilityScore = q.availability_status === "quoted" ? 1.0 : 0.6;

        const weightedTotal =
          (priceScore * weights.price) +
          (speedScore * weights.speed) +
          (ratingScore * weights.rating) +
          (capacityScore * weights.capacity) +
          (availabilityScore * weights.availability);

        return {
          quote_id: q.id,
          partner_id: q.partner_id,
          quoted_price: q.quoted_price,
          price_score: Math.round(priceScore * 1000) / 1000,
          speed_score: Math.round(speedScore * 1000) / 1000,
          rating_score: Math.round(ratingScore * 1000) / 1000,
          capacity_score: Math.round(capacityScore * 1000) / 1000,
          availability_score: Math.round(availabilityScore * 1000) / 1000,
          weighted_total: Math.round(weightedTotal * 1000) / 1000,
        };
      });

      // Sort by weighted_total DESC
      scored.sort((a: any, b: any) => b.weighted_total - a.weighted_total);
      const winner = scored[0];

      // Margin engine
      const { data: marginConfig } = await supabase
        .from("cb_dispatch_config").select("*").eq("category", "coach_bus").single();
      const targetMarginPct = marginConfig?.margin_percentage || 25;
      const minMarginPct = 15;
      const maxMarginPct = 40;

      let marginPct = targetMarginPct;
      const partnerPrice = winner.quoted_price;
      let markupAmount = Math.round(partnerPrice * (marginPct / 100) * 100) / 100;
      let finalCustomerPrice = Math.round((partnerPrice + markupAmount) * 100) / 100;

      // Cap: if price > $10k and margin > 30%, reduce
      if (finalCustomerPrice > 10000 && marginPct > 30) {
        marginPct = 30;
        markupAmount = Math.round(partnerPrice * (marginPct / 100) * 100) / 100;
        finalCustomerPrice = Math.round((partnerPrice + markupAmount) * 100) / 100;
      }
      // Floor: ensure minimum margin
      if (marginPct < minMarginPct) {
        marginPct = minMarginPct;
        markupAmount = Math.round(partnerPrice * (marginPct / 100) * 100) / 100;
        finalCustomerPrice = Math.round((partnerPrice + markupAmount) * 100) / 100;
      }

      // Store evaluations for ALL quotes
      const evalRows = scored.map((s: any) => ({
        booking_request_id: request_id,
        quote_id: s.quote_id,
        partner_id: s.partner_id,
        price_score: s.price_score,
        speed_score: s.speed_score,
        rating_score: s.rating_score,
        capacity_score: s.capacity_score,
        availability_score: s.availability_score,
        weighted_total: s.weighted_total,
        is_winner: s.quote_id === winner.quote_id,
        selection_reason: s.quote_id === winner.quote_id ? "auto_selected_highest_score" : null,
        trigger_type: trigger_type || "threshold",
        partner_price: s.quoted_price,
        margin_applied: s.quote_id === winner.quote_id ? marginPct : null,
        markup_amount: s.quote_id === winner.quote_id ? markupAmount : null,
        final_customer_price: s.quote_id === winner.quote_id ? finalCustomerPrice : null,
        scoring_weights: weights,
      }));

      await supabase.from("cb_auto_evaluations").insert(evalRows);

      // Auto-select the winning quote (reuse select_quote logic)
      await supabase.from("cb_partner_quotes")
        .update({ is_selected: true }).eq("id", winner.quote_id);

      // Update margin table
      await supabase.from("cb_quote_margins").upsert({
        quote_id: winner.quote_id,
        partner_price: partnerPrice,
        margin_type: "percentage",
        margin_value: marginPct,
        markup_amount: markupAmount,
        final_customer_price: finalCustomerPrice,
      }, { onConflict: "quote_id" });

      // Create selection event
      await supabase.from("cb_quote_selection_events").insert({
        booking_request_id: request_id,
        selected_quote_id: winner.quote_id,
        selected_partner_id: winner.partner_id,
        selection_reason: "auto_selected",
        quote_snapshot: { scores: scored, margin: { marginPct, markupAmount, finalCustomerPrice } },
        backup_quote_ids: scored.length > 1 ? [scored[1].quote_id] : null,
      });

      // Update request
      await supabase.from("cb_booking_requests").update({
        status: "selected",
        selected_quote_id: winner.quote_id,
        selected_partner_id: winner.partner_id,
        recommended_quote_id: winner.quote_id,
        customer_offer_price: finalCustomerPrice,
        updated_at: new Date().toISOString(),
      }).eq("id", request_id);

      // Auto-send customer offer
      const { data: winningQuote } = await supabase
        .from("cb_partner_quotes").select("*").eq("id", winner.quote_id).single();

      const approveUrl = `${baseUrl}/booking/approve/${request.id}`;
      const offerResults: any[] = [];

      if (request.customer_phone) {
        const smsBody = `🚌 Your Coach Bus is Available!\n${request.pickup_city} → ${request.dropoff_city}\n${request.trip_date || "TBD"}\nPrice: $${finalCustomerPrice.toLocaleString()}\n\nConfirm: ${approveUrl}`;
        const smsResult = await sendSMS(request.customer_phone, smsBody);
        offerResults.push({ channel: "sms", ...smsResult });
        await logComm(supabase, request.id, null, "outbound", "sms", "cb_auto_customer_offer_sms",
          smsBody, smsResult.success ? "sent" : "failed", smsResult.sid);
      }

      if (request.customer_email) {
        const marginObj = { final_customer_price: finalCustomerPrice };
        const html = buildCustomerOfferEmail(request, winningQuote || {}, marginObj, approveUrl);
        const emailResult = await sendEmail(
          request.customer_email,
          `🚌 Your Coach Bus Quote – ${request.pickup_city} → ${request.dropoff_city}`,
          html
        );
        offerResults.push({ channel: "email", ...emailResult });
        await logComm(supabase, request.id, null, "outbound", "email", "cb_auto_customer_offer_email",
          `Auto offer: $${finalCustomerPrice}`, emailResult.success ? "sent" : "failed");
      }

      // Update status to customer_review
      await supabase.from("cb_booking_requests").update({
        status: "customer_review",
        customer_offer_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", request_id);

      return json({
        success: true,
        auto_selected: true,
        winner: {
          quote_id: winner.quote_id,
          partner_id: winner.partner_id,
          weighted_score: winner.weighted_total,
          partner_price: partnerPrice,
          margin_pct: marginPct,
          markup_amount: markupAmount,
          final_customer_price: finalCustomerPrice,
        },
        total_evaluated: scored.length,
        scores: scored,
        offer_sent: offerResults,
      });
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
