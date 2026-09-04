// TWILIO ADMIN — SMS number configuration (audit + apply).
//
// Read/writes the Messaging section of an IncomingPhoneNumber:
//   SmsUrl / SmsMethod / SmsFallbackUrl  → inbound message webhook
// Voice fields are NEVER touched.
//
// This is an admin tool that CALLS Twilio (it is not a Twilio webhook), so it
// is gated with JWT + admin/owner role — no signature check applies here.
//
// actions:
//   audit  { phone_number }              → current Twilio config, no writes
//   apply  { phone_number, sms_url? }    → sets SmsUrl/SmsMethod/SmsFallbackUrl

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── JWT + role gate: admin or owner only ──
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "auth_required" }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "invalid_token" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: user.id, _role: "owner" });
    if (!isAdmin && !isOwner) return json({ error: "forbidden", detail: "admin or owner role required" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action || "audit");
    const phone = String(body.phone_number || "").trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return json({ error: "bad_request", detail: "phone_number must be E.164, e.g. +18776818621" }, 400);
    }

    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
    if (!TWILIO_SID.startsWith("AC") || TWILIO_SID.length < 34) {
      return json({ error: "credential_issue", detail: "TWILIO_ACCOUNT_SID invalid (must start with AC)" }, 400);
    }
    if (!TWILIO_TOKEN || TWILIO_TOKEN.length < 32) {
      return json({ error: "credential_issue", detail: "TWILIO_AUTH_TOKEN missing/invalid" }, 400);
    }
    const auth = `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`;

    // ── Look up the number ──
    const lookupRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone)}`,
      { headers: { Authorization: auth } },
    );
    const lookupBody = await lookupRes.text();
    if (!lookupRes.ok) {
      console.error(`[twilio-admin-sms-config] lookup failed [${lookupRes.status}]: ${lookupBody}`);
      return json({ error: "twilio_error", status: lookupRes.status, details: lookupBody }, lookupRes.status);
    }
    const lookupData = JSON.parse(lookupBody);
    const num = lookupData.incoming_phone_numbers?.[0];
    if (!num) return json({ error: "not_found", detail: `${phone} is not in this Twilio account` }, 404);

    const shape = (n: any) => ({
      sid: n.sid,
      phone_number: n.phone_number,
      friendly_name: n.friendly_name,
      sms_url: n.sms_url || null,
      sms_method: n.sms_method || null,
      sms_fallback_url: n.sms_fallback_url || null,
      messaging_service_sid: n.messaging_service_sid || null,
      status_callback: n.status_callback || null,
      status_callback_method: n.status_callback_method || null,
      voice_url: n.voice_url || null,
      voice_method: n.voice_method || null,
      capabilities: n.capabilities || null,
    });

    if (action === "audit") {
      return json({ ok: true, action: "audit", config: shape(num) });
    }

    if (action !== "apply") return json({ error: "bad_request", detail: `unknown action ${action}` }, 400);

    const before = shape(num);
    const smsUrl = String(body.sms_url || `${SUPABASE_URL}/functions/v1/twilio-sms-webhook`);
    if (!smsUrl.startsWith(`${SUPABASE_URL}/functions/v1/`)) {
      return json({ error: "bad_request", detail: "sms_url must be an endpoint in this project" }, 400);
    }

    const form = new URLSearchParams({
      SmsUrl: smsUrl,
      SmsMethod: "POST",
      SmsFallbackUrl: smsUrl,
      SmsFallbackMethod: "POST",
    });

    const updRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers/${num.sid}.json`,
      {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      },
    );
    const updBody = await updRes.text();
    if (!updRes.ok) {
      console.error(`[twilio-admin-sms-config] update failed [${updRes.status}]: ${updBody}`);
      return json({ error: "twilio_error", status: updRes.status, details: updBody }, updRes.status);
    }
    const after = shape(JSON.parse(updBody));

    // Keep the local directory row honest.
    await supabase
      .from("dc_phone_numbers")
      .update({ sms_webhook_url: smsUrl, updated_at: new Date().toISOString() })
      .ilike("phone_number", `%${phone.replace(/\D/g, "").slice(-10)}`);

    console.log(`[twilio-admin-sms-config] ${phone} SmsUrl ${before.sms_url ?? "none"} → ${after.sms_url}`);
    return json({ ok: true, action: "apply", before, after });
  } catch (e) {
    console.error("[twilio-admin-sms-config] error", (e as Error).message);
    return json({ error: "internal_error", detail: (e as Error).message }, 500);
  }
});
