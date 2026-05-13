// send-operator-sms — operator-initiated outbound SMS via shared Twilio number.
// Respects DEV_PHONE_LOCK and contact opt-out flag.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  sendOperatorSms,
  TWILIO_SHARED_NUMBER,
  DEV_PHONE_LOCK,
} from "../_shared/twilio-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "csr",
  "ambassador",
  "driver",
  "biker",
  "va",
  "employee",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const svc = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Invalid auth" }, 401);
    }
    const operatorId = userData.user.id;

    // Role check
    const { data: roles } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", operatorId);
    const hasRole = (roles || []).some((r: any) =>
      ALLOWED_ROLES.includes(r.role),
    );
    if (!hasRole) {
      return json({ error: "Operator role required" }, 403);
    }

    const body = await req.json();
    const {
      store_id,
      contact_id,
      to_phone,
      body: messageBody,
    } = body || {};

    if (!store_id || !to_phone || !messageBody) {
      return json(
        { error: "store_id, to_phone, body are required" },
        400,
      );
    }
    if (typeof messageBody !== "string" || messageBody.length > 1600) {
      return json({ error: "body must be string ≤1600 chars" }, 400);
    }
    if (!/^\+\d{8,16}$/.test(to_phone)) {
      return json({ error: "to_phone must be E.164" }, 400);
    }

    // Opt-out check
    if (contact_id) {
      const { data: contact } = await svc
        .from("store_contacts")
        .select("opted_out")
        .eq("id", contact_id)
        .maybeSingle();
      if (contact?.opted_out) {
        return json(
          { error: "Recipient has opted out", code: "OPTED_OUT" },
          403,
        );
      }
    } else {
      const { data: contacts } = await svc
        .from("store_contacts")
        .select("opted_out")
        .eq("store_id", store_id)
        .eq("phone", to_phone)
        .eq("opted_out", true)
        .limit(1);
      if (contacts && contacts.length > 0) {
        return json(
          { error: "Recipient has opted out", code: "OPTED_OUT" },
          403,
        );
      }
    }

    // Lookup business_id from store
    const { data: store } = await svc
      .from("stores")
      .select("business_id")
      .eq("id", store_id)
      .maybeSingle();

    // Send via Twilio
    const { sid, actualTo, overridden } = await sendOperatorSms({
      to: to_phone,
      body: messageBody,
    });

    // Insert log row (trigger handles thread)
    const { data: log, error: logErr } = await svc
      .from("communication_logs")
      .insert({
        channel: "sms",
        direction: "outbound",
        operator_id: operatorId,
        store_id,
        contact_id: contact_id || null,
        message_content: messageBody,
        summary: messageBody.slice(0, 80),
        recipient_phone: actualTo,
        sender_phone: TWILIO_SHARED_NUMBER,
        twilio_sid: sid,
        bland_ai_handled: false,
        business_id: store?.business_id || null,
        delivery_status: "sent",
      })
      .select("id, thread_id")
      .single();

    if (logErr) {
      console.error("[send-operator-sms] log insert failed", logErr);
    }

    return json({
      success: true,
      twilio_sid: sid,
      log_id: log?.id,
      thread_id: log?.thread_id,
      actual_recipient: actualTo,
      intended_recipient: to_phone,
      dev_lock_active: DEV_PHONE_LOCK,
      warning: overridden
        ? "DEV_PHONE_LOCK is ON — SMS sent to dev test number, not actual recipient"
        : undefined,
    });
  } catch (e: any) {
    console.error("[send-operator-sms] error", e);
    return json({ error: e.message || "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
