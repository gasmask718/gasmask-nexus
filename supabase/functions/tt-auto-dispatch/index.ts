import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ─── Commission rates by service type ─── */
const commissionRates: Record<string, number> = {
  luxury_transport: 0.75,
  exotic_rental: 0.7,
  helicopter: 0.8,
  private_jet: 0.85,
  yacht_charter: 0.8,
  private_chef: 0.7,
  nightlife_vip: 0.65,
  wellness_massage: 0.7,
  beauty_services: 0.7,
  media_production: 0.7,
  security_detail: 0.75,
  event_space: 0.7,
  default: 0.7,
};

/* ─── Service type → keyword map for category matching ─── */
const serviceTypeMap: Record<string, string[]> = {
  luxury_transport: ["chauffeur", "driver", "transport", "black car", "limo"],
  exotic_rental: ["exotic", "rental", "driver", "chauffeur"],
  helicopter: ["helicopter", "pilot", "aviation"],
  private_jet: ["jet", "pilot", "aviation"],
  yacht_charter: ["yacht", "boat", "captain", "vessel"],
  private_chef: ["chef", "cook", "culinary"],
  nightlife_vip: ["nightlife", "promoter", "vip"],
  wellness_massage: ["massage", "wellness", "spa"],
  beauty_services: ["beauty", "makeup", "stylist"],
  media_production: ["photographer", "videographer", "media"],
  security_detail: ["security", "protection"],
  event_space: ["event", "coordinator", "planner"],
};

/* ─── Helpers ─── */

function extractCity(location: string): string {
  if (!location) return "";
  const parts = location.split(",").map((s) => s.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

function fmtDate(d: string | null): string {
  if (!d) return "TBD";
  try {
    return new Date(d).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function scorePartner(
  p: any,
  serviceType: string,
  pickupCity: string,
  bookingValue: number
): number {
  let score = 0;
  score += Math.min((p.rating || 0) * 4, 20);
  const rt = p.response_time_minutes || 999;
  if (rt < 30) score += 30;
  else if (rt < 60) score += 20;
  else if (rt < 120) score += 10;
  score += Math.min((p.trust_score || 0) / 10, 10);
  const markets = (p.markets || p.market || []) as string[];
  if (
    pickupCity &&
    markets.some(
      (m: string) => m.toLowerCase() === pickupCity.toLowerCase()
    )
  )
    score += 30;
  const caps = p.capabilities || {};
  if (caps.vip_handling) score += 15;
  if (caps.last_minute) score += 10;
  return Math.round(score * 10) / 10;
}

async function sendSMS(
  sid: string,
  token: string,
  from: string,
  to: string,
  body: string
) {
  // TWILIO_ACCOUNT_SID must be the real AC-prefixed Account SID (no rewriting).
  const fixedSid = sid;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${fixedSid}/Messages.json`;
  const auth = btoa(`${fixedSid}:${token}`);
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
}

async function alertDavid(
  sid: string | undefined,
  token: string | undefined,
  from: string | undefined,
  davidPhone: string | undefined,
  msg: string
) {
  if (sid && token && from && davidPhone) {
    await sendSMS(sid, token, from, davidPhone, msg);
  } else {
    console.log("[DAVID ALERT — no creds]", msg);
  }
}

function buildPartnerSMS(
  booking: any,
  serviceType: string,
  payoutAmount: number,
  isEscalation: boolean,
  windowMinutes: number
): string {
  const prefix = isEscalation ? "🔄 URGENT ESCALATION" : "🚗 New TopTier Booking";
  return (
    `${prefix}\n` +
    `Service: ${serviceType.replace(/_/g, " ").toUpperCase()}\n` +
    `Client: ${booking.client_name}\n` +
    `Pickup: ${booking.pickup_location || "TBD"}\n` +
    `Date: ${fmtDate(booking.scheduled_at)}\n` +
    `Payout: $${payoutAmount.toLocaleString()}\n` +
    `Ref: ${booking.booking_reference}\n\n` +
    `Reply YES to accept or NO to decline.\n` +
    `Expires in ${windowMinutes} minutes.`
  );
}

/* ─── Backup + Fallback cascade ─── */

async function tryBackupOrFallback(
  supabase: any,
  publicClient: any,
  booking: any,
  vehicle: any,
  serviceType: string,
  pickupCity: string,
  bookingValue: number,
  payoutAmount: number,
  excludePartnerId: string,
  twilioSid: string | undefined,
  twilioToken: string | undefined,
  fromPhone: string | undefined,
  davidPhone: string | undefined
): Promise<Response> {
  // ── Try backup partner ──
  if (
    vehicle.backup_partner_id &&
    vehicle.backup_partner_id !== excludePartnerId
  ) {
    const { data: backup } = await publicClient
      .from("partners")
      .select("id,business_name,phone,email,status,is_active")
      .eq("id", vehicle.backup_partner_id)
      .eq("status", "approved")
      .eq("is_active", true)
      .maybeSingle();

    if (backup?.phone) {
      await alertDavid(
        twilioSid, twilioToken, fromPhone, davidPhone,
        `🔄 BACKUP DISPATCH\n` +
        `Vehicle: ${vehicle.name}\n` +
        `Primary declined/expired\n` +
        `Trying backup: ${backup.business_name}\n` +
        `Phone: ${backup.phone}\n` +
        `Ref: ${booking.booking_reference}\n` +
        `20 min window`
      );

      const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      const msg = buildPartnerSMS(booking, serviceType, payoutAmount, true, 20);

      if (twilioSid && twilioToken && fromPhone) {
        await sendSMS(twilioSid, twilioToken, fromPhone, backup.phone, msg);
      }

      const { data: dispatchReq } = await supabase
        .from("tt_dispatch_requests")
        .insert({
          booking_id: booking.id,
          booking_reference: booking.booking_reference,
          service_type: serviceType,
          service_category: serviceType,
          customer_name: booking.client_name,
          customer_phone: booking.client_phone,
          pickup_location: booking.pickup_location,
          dropoff_location: booking.dropoff_location,
          scheduled_at: booking.scheduled_at,
          special_requests: booking.special_requests,
          total_booking_value: bookingValue,
          payout_amount: payoutAmount,
          partner_id: backup.id,
          partner_name: backup.business_name,
          partner_phone: backup.phone,
          status: "sent",
          sent_at: new Date().toISOString(),
          expires_at: expiresAt,
          sms_message: msg,
        })
        .select()
        .single();

      await supabase
        .from("tt_bookings")
        .update({
          status: "dispatched",
          dispatched_to: backup.business_name,
          dispatch_method: "vehicle_backup",
        })
        .eq("id", booking.id);

      return new Response(
        JSON.stringify({
          success: true,
          dispatched: true,
          dispatch_type: "vehicle_backup",
          partner: backup.business_name,
          vehicle: vehicle.name,
          payout: payoutAmount,
          expires_at: expiresAt,
          dispatch_request_id: dispatchReq?.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // ── No backup — alert David ──
  await alertDavid(
    twilioSid, twilioToken, fromPhone, davidPhone,
    `⚠️ VEHICLE DISPATCH FALLBACK\n` +
    `Vehicle: ${vehicle.name}\n` +
    `Primary + backup both unavailable\n` +
    `Falling back to category dispatch\n` +
    `Ref: ${booking.booking_reference}`
  );

  // ── Category fallback ──
  const { data: partners } = await supabase
    .from("tt_service_partners")
    .select("*")
    .eq("status", "active")
    .eq("is_available", true)
    .neq("id", excludePartnerId);

  const keywords = serviceTypeMap[serviceType] || [serviceType];
  const scored = (partners || [])
    .filter((p: any) =>
      keywords.some((k) =>
        (p.service_type || "").toLowerCase().includes(k)
      )
    )
    .map((p: any) => ({
      ...p,
      score: scorePartner(p, serviceType, pickupCity, bookingValue),
    }))
    .sort((a: any, b: any) => b.score - a.score);

  const fallback = scored[0] || null;

  if (!fallback) {
    await supabase.from("tt_dispatch_requests").insert({
      booking_id: booking.id,
      booking_reference: booking.booking_reference,
      service_type: serviceType,
      status: "pending",
      total_booking_value: bookingValue,
      payout_amount: payoutAmount,
      customer_name: booking.client_name,
      pickup_location: booking.pickup_location,
      scheduled_at: booking.scheduled_at,
    });

    await supabase
      .from("tt_bookings")
      .update({ status: "needs_dispatch" })
      .eq("id", booking.id);

    await alertDavid(
      twilioSid, twilioToken, fromPhone, davidPhone,
      `🚨 ALL DISPATCH PATHS EXHAUSTED\n` +
      `Vehicle: ${vehicle.name}\n` +
      `Ref: ${booking.booking_reference}\n` +
      `Manual dispatch required immediately.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: false,
        dispatch_type: "exhausted",
        reason: "all_paths_exhausted",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Send to fallback partner
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const msg = buildPartnerSMS(booking, serviceType, payoutAmount, true, 15);

  if (twilioSid && twilioToken && fromPhone && fallback.phone) {
    await sendSMS(twilioSid, twilioToken, fromPhone, fallback.phone, msg);
  }

  const { data: dispatchReq } = await supabase
    .from("tt_dispatch_requests")
    .insert({
      booking_id: booking.id,
      booking_reference: booking.booking_reference,
      service_type: serviceType,
      service_category: serviceType,
      customer_name: booking.client_name,
      customer_phone: booking.client_phone,
      pickup_location: booking.pickup_location,
      dropoff_location: booking.dropoff_location,
      scheduled_at: booking.scheduled_at,
      special_requests: booking.special_requests,
      total_booking_value: bookingValue,
      payout_amount: payoutAmount,
      partner_id: fallback.id,
      partner_name: fallback.business_name,
      partner_phone: fallback.phone,
      status: "sent",
      sent_at: new Date().toISOString(),
      expires_at: expiresAt,
      sms_message: msg,
    })
    .select()
    .single();

  await supabase
    .from("tt_bookings")
    .update({
      status: "dispatched",
      dispatched_to: fallback.business_name,
      dispatch_method: "category_fallback",
    })
    .eq("id", booking.id);

  await supabase.from("tt_notifications_log").insert({
    booking_id: booking.id,
    type: "category_fallback_dispatch",
    channel: "sms",
    recipient: fallback.phone,
    message: `Fallback dispatch to ${fallback.business_name}`,
    status: "sent",
  });

  return new Response(
    JSON.stringify({
      success: true,
      dispatched: true,
      dispatch_type: "category_fallback",
      partner: fallback.business_name,
      partner_phone: fallback.phone,
      payout: payoutAmount,
      expires_at: expiresAt,
      window_minutes: 15,
      dispatch_request_id: dispatchReq?.id,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/* ═══════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════ */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const publicClient = createClient(
    "https://hruhkyvwtfpfviwnvhne.supabase.co",
    Deno.env.get("PUBLIC_SITE_SERVICE_ROLE_KEY")!
  );

  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromPhone = Deno.env.get("TT_PHONE_NUMBER");
  const davidPhone = Deno.env.get("DAVID_PHONE_NUMBER");

  try {
    const { booking_id, exclude_partner_id } = await req.json();

    // ── Fetch booking ──
    const { data: booking, error: bookingErr } = await supabase
      .from("tt_bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) {
      throw new Error("Booking not found: " + booking_id);
    }

    const serviceType = booking.service_type || "luxury_transport";
    const pickupCity = extractCity(booking.pickup_location || "");
    const bookingValue = Number(booking.total_price || 0);
    const partnerRate = commissionRates[serviceType] || commissionRates.default;
    const payoutAmount = Math.round(bookingValue * partnerRate * 100) / 100;

    /* ═══════════════════════════════════════
       STEP 1 — VEHICLE-SPECIFIC DISPATCH
       ═══════════════════════════════════════ */

    const bookingMeta = booking.metadata as any;
    const vehicleId = booking.vehicle_id || bookingMeta?.vehicle_id || null;
    const vehicleName = bookingMeta?.vehicle_name || null;

    if (vehicleId || vehicleName) {
      let vehicleQuery = publicClient
        .from("vehicles")
        .select(
          [
            "id", "name", "partner_id", "partner_name",
            "partner_phone", "dispatch_phone",
            "dispatch_notes", "auto_dispatch",
            "response_time_minutes", "deposit_amount",
            "backup_partner_id",
          ].join(",")
        )
        .eq("is_active", true);

      if (vehicleId) {
        vehicleQuery = vehicleQuery.eq("id", vehicleId);
      } else {
        vehicleQuery = vehicleQuery.eq("name", vehicleName);
      }

      const { data: vehicle } = await vehicleQuery.maybeSingle();

      if (vehicle?.partner_id && vehicle.auto_dispatch) {
        const dispatchPhone = vehicle.dispatch_phone || vehicle.partner_phone;

        // Skip if this partner already declined
        if (exclude_partner_id && exclude_partner_id === vehicle.partner_id) {
          return await tryBackupOrFallback(
            supabase, publicClient, booking, vehicle,
            serviceType, pickupCity, bookingValue,
            payoutAmount, exclude_partner_id,
            twilioSid, twilioToken, fromPhone, davidPhone
          );
        }

        if (dispatchPhone) {
          // Alert David
          await alertDavid(
            twilioSid, twilioToken, fromPhone, davidPhone,
            `🚗 VEHICLE DIRECT DISPATCH\n` +
            `Vehicle: ${vehicle.name}\n` +
            `Partner: ${vehicle.partner_name}\n` +
            `Phone: ${dispatchPhone}\n` +
            `Client: ${booking.client_name}\n` +
            `Pickup: ${booking.pickup_location}\n` +
            `Date: ${fmtDate(booking.scheduled_at)}\n` +
            `Value: $${bookingValue.toLocaleString()}\n` +
            `Ref: ${booking.booking_reference}\n` +
            `30 min window`
          );

          const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          const partnerMsg = buildPartnerSMS(booking, serviceType, payoutAmount, false, 30);

          // Send SMS to vehicle partner
          if (twilioSid && twilioToken && fromPhone && dispatchPhone) {
            await sendSMS(twilioSid, twilioToken, fromPhone, dispatchPhone, partnerMsg);
          }

          // Log dispatch request
          const { data: dispatchReq } = await supabase
            .from("tt_dispatch_requests")
            .insert({
              booking_id: booking.id,
              booking_reference: booking.booking_reference,
              service_type: serviceType,
              service_category: serviceType,
              customer_name: booking.client_name,
              customer_phone: booking.client_phone,
              pickup_location: booking.pickup_location,
              dropoff_location: booking.dropoff_location,
              scheduled_at: booking.scheduled_at,
              special_requests: booking.special_requests,
              total_booking_value: bookingValue,
              payout_amount: payoutAmount,
              partner_id: vehicle.partner_id,
              partner_name: vehicle.partner_name,
              partner_phone: dispatchPhone,
              status: "sent",
              sent_at: new Date().toISOString(),
              expires_at: expiresAt,
              sms_message: partnerMsg,
              dispatch_notes: vehicle.dispatch_notes,
            })
            .select()
            .single();

          await supabase
            .from("tt_bookings")
            .update({
              status: "dispatched",
              vehicle_name: vehicle.name,
              dispatched_to: vehicle.partner_name,
              dispatch_method: "vehicle_direct",
            })
            .eq("id", booking_id);

          await supabase.from("tt_notifications_log").insert({
            booking_id: booking.id,
            type: "vehicle_direct_dispatch",
            channel: "sms",
            recipient: dispatchPhone,
            message: `Direct dispatch to ${vehicle.partner_name} for ${vehicle.name}`,
            status: "sent",
          });

          return new Response(
            JSON.stringify({
              success: true,
              dispatched: true,
              dispatch_type: "vehicle_direct",
              partner: vehicle.partner_name,
              partner_phone: dispatchPhone,
              vehicle: vehicle.name,
              payout: payoutAmount,
              expires_at: expiresAt,
              window_minutes: 30,
              dispatch_request_id: dispatchReq?.id,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Phone missing — alert David
        await alertDavid(
          twilioSid, twilioToken, fromPhone, davidPhone,
          `⚠️ DISPATCH PHONE MISSING\n` +
          `Vehicle: ${vehicle.name}\n` +
          `Partner: ${vehicle.partner_name}\n` +
          `No dispatch phone on file.\n` +
          `Ref: ${booking.booking_reference}\n` +
          `Manual dispatch required.`
        );
      }

      // Vehicle found but no partner assigned
      if (vehicle && !vehicle.partner_id) {
        await alertDavid(
          twilioSid, twilioToken, fromPhone, davidPhone,
          `⚠️ NO PARTNER ASSIGNED\n` +
          `Vehicle: ${vehicle.name} has no partner.\n` +
          `Booking: ${booking.booking_reference}\n` +
          `Falling back to category dispatch.\n` +
          `Fix at: admin/vehicles`
        );
      }
    }

    /* ═══════════════════════════════════════
       STEP 2 — GENERIC CATEGORY DISPATCH
       ═══════════════════════════════════════ */

    let query = supabase
      .from("tt_service_partners")
      .select("*")
      .eq("status", "active")
      .eq("is_available", true);

    if (exclude_partner_id) {
      query = query.neq("id", exclude_partner_id);
    }

    const { data: partners } = await query;

    const keywords = serviceTypeMap[serviceType] || [serviceType];
    const scored = (partners || [])
      .filter((p: any) =>
        keywords.some((k) =>
          (p.service_type || "").toLowerCase().includes(k)
        )
      )
      .map((p: any) => ({
        ...p,
        score: scorePartner(p, serviceType, pickupCity, bookingValue),
      }))
      .sort((a: any, b: any) => b.score - a.score);

    const bestPartner = scored[0] || null;

    // Alert David
    await alertDavid(
      twilioSid, twilioToken, fromPhone, davidPhone,
      `🔔 NEW TOPTIER BOOKING\n` +
      `Service: ${serviceType.replace(/_/g, " ").toUpperCase()}\n` +
      `Client: ${booking.client_name}\n` +
      `Phone: ${booking.client_phone || "N/A"}\n` +
      `Pickup: ${booking.pickup_location || "TBD"}\n` +
      `Date: ${fmtDate(booking.scheduled_at)}\n` +
      `Value: $${bookingValue.toLocaleString()}\n` +
      `Ref: ${booking.booking_reference}\n` +
      (bestPartner
        ? `Dispatching to: ${bestPartner.business_name}`
        : `⚠️ No partner found — manual needed`)
    );

    if (!bestPartner) {
      await supabase.from("tt_dispatch_requests").insert({
        booking_id: booking.id,
        booking_reference: booking.booking_reference,
        service_type: serviceType,
        service_category: serviceType,
        customer_name: booking.client_name,
        customer_phone: booking.client_phone,
        pickup_location: booking.pickup_location,
        scheduled_at: booking.scheduled_at,
        total_booking_value: bookingValue,
        payout_amount: payoutAmount,
        status: "pending",
      });

      await supabase
        .from("tt_bookings")
        .update({ status: "needs_dispatch" })
        .eq("id", booking_id);

      return new Response(
        JSON.stringify({
          success: true,
          dispatched: false,
          reason: "no_partners_available",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isEscalation = !!exclude_partner_id;
    const expiryMinutes = isEscalation ? 15 : 20;
    const expiresAt = new Date(
      Date.now() + expiryMinutes * 60 * 1000
    ).toISOString();

    const partnerMsg = buildPartnerSMS(
      booking, serviceType, payoutAmount, isEscalation, expiryMinutes
    );

    const { data: dispatchReq } = await supabase
      .from("tt_dispatch_requests")
      .insert({
        booking_id: booking.id,
        booking_reference: booking.booking_reference,
        service_type: serviceType,
        service_category: serviceType,
        customer_name: booking.client_name,
        customer_phone: booking.client_phone,
        pickup_location: booking.pickup_location,
        dropoff_location: booking.dropoff_location,
        scheduled_at: booking.scheduled_at,
        special_requests: booking.special_requests,
        total_booking_value: bookingValue,
        payout_amount: payoutAmount,
        partner_id: bestPartner.id,
        partner_name: bestPartner.business_name,
        partner_phone: bestPartner.phone,
        status: "sent",
        sent_at: new Date().toISOString(),
        expires_at: expiresAt,
        sms_message: partnerMsg,
      })
      .select()
      .single();

    if (twilioSid && twilioToken && fromPhone && bestPartner.phone) {
      await sendSMS(twilioSid, twilioToken, fromPhone, bestPartner.phone, partnerMsg);
    }

    await supabase
      .from("tt_bookings")
      .update({
        status: "dispatched",
        dispatched_to: bestPartner.business_name,
        dispatch_method: isEscalation ? "category_escalation" : "category_generic",
      })
      .eq("id", booking_id);

    await supabase.from("tt_notifications_log").insert({
      booking_id: booking.id,
      type: "auto_dispatch_sent",
      channel: "sms",
      recipient: bestPartner.phone,
      message: `Auto-dispatched ${booking.booking_reference} to ${bestPartner.business_name}`,
      status: "sent",
    });

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: true,
        dispatch_type: isEscalation ? "category_escalation" : "category_generic",
        partner: bestPartner.business_name,
        partner_phone: bestPartner.phone,
        payout: payoutAmount,
        expires_at: expiresAt,
        window_minutes: expiryMinutes,
        dispatch_request_id: dispatchReq?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("tt-auto-dispatch error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
