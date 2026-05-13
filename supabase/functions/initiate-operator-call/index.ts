// initiate-operator-call — operator-initiated outbound call via shared Twilio
// number with recording enabled. Respects DEV_PHONE_LOCK and opt-out.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  initiateOperatorCall,
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
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

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

    const { data: roles } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", operatorId);
    const hasRole = (roles || []).some((r: any) =>
      ALLOWED_ROLES.includes(r.role),
    );
    if (!hasRole) return json({ error: "Operator role required" }, 403);

    const body = await req.json();
    const { store_id, contact_id, to_phone } = body || {};

    if (!store_id || !to_phone) {
      return json({ error: "store_id and to_phone are required" }, 400);
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
    }

    const { data: store } = await svc
      .from("stores")
      .select("business_id")
      .eq("id", store_id)
      .maybeSingle();

    // Pre-create log row
    const { data: log, error: logErr } = await svc
      .from("communication_logs")
      .insert({
        channel: "call",
        direction: "outbound",
        operator_id: operatorId,
        store_id,
        contact_id: contact_id || null,
        summary: "Call initiated",
        recipient_phone: to_phone,
        sender_phone: TWILIO_SHARED_NUMBER,
        bland_ai_handled: false,
        business_id: store?.business_id || null,
        delivery_status: "initiated",
      })
      .select("id, thread_id")
      .single();

    if (logErr || !log) {
      console.error("[initiate-operator-call] pre-log failed", logErr);
      return json({ error: "Failed to create log row" }, 500);
    }

    const projectId = Deno.env.get("VITE_SUPABASE_PROJECT_ID") ||
      supabaseUrl.replace("https://", "").split(".")[0];
    const recordingCallbackUrl =
      `https://${projectId}.supabase.co/functions/v1/twilio-recording-webhook?log_id=${log.id}`;

    try {
      const { sid, actualTo, overridden } = await initiateOperatorCall({
        to: to_phone,
        recordingCallbackUrl,
      });

      await svc
        .from("communication_logs")
        .update({ twilio_sid: sid, recipient_phone: actualTo })
        .eq("id", log.id);

      return json({
        success: true,
        twilio_sid: sid,
        log_id: log.id,
        thread_id: log.thread_id,
        actual_recipient: actualTo,
        intended_recipient: to_phone,
        dev_lock_active: DEV_PHONE_LOCK,
        warning: overridden
          ? "DEV_PHONE_LOCK is ON — call placed to dev test number, not actual recipient"
          : undefined,
      });
    } catch (callErr: any) {
      await svc
        .from("communication_logs")
        .update({ delivery_status: "failed", outcome: callErr.message })
        .eq("id", log.id);
      throw callErr;
    }
  } catch (e: any) {
    console.error("[initiate-operator-call] error", e);
    return json({ error: e.message || "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
