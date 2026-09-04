// TWILIO ADMIN — VOICE number configuration (audit + apply).
//
// Read/writes the Voice section of an IncomingPhoneNumber:
//   VoiceUrl / VoiceMethod / VoiceFallbackUrl → inbound call webhook
//   StatusCallback                            → canonical call-status writer
// Messaging fields are NEVER touched.
//
// This is an admin tool that CALLS Twilio (it is not a Twilio webhook), so it
// is gated with JWT + admin/owner role — no signature check applies here.
//
// actions:
//   audit  { phone_number }               → current Twilio config, no writes
//   apply  { phone_number, voice_url? }   → sets VoiceUrl/Fallback/StatusCallback

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

    const lookupRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone)}`,
      { headers: { Authorization: auth } },
    );
    const lookupBody = await lookupRes.text();
    if (!lookupRes.ok) {
      console.error(`[twilio-admin-voice-config] lookup failed [${lookupRes.status}]: ${lookupBody}`);
      return json({ error: "twilio_error", status: lookupRes.status, details: lookupBody }, lookupRes.status);
    }
    const num = JSON.parse(lookupBody).incoming_phone_numbers?.[0];
    if (!num) return json({ error: "not_found", detail: `${phone} is not in this Twilio account` }, 404);

    // deno-lint-ignore no-explicit-any
    const shape = (n: any) => ({
      sid: n.sid,
      phone_number: n.phone_number,
      friendly_name: n.friendly_name,
      voice_url: n.voice_url || null,
      voice_method: n.voice_method || null,
      voice_fallback_url: n.voice_fallback_url || null,
      voice_application_sid: n.voice_application_sid || null,
      trunk_sid: n.trunk_sid || null,
      status_callback: n.status_callback || null,
      status_callback_method: n.status_callback_method || null,
      sms_url: n.sms_url || null,
      capabilities: n.capabilities || null,
    });

    // Local routing picture, so audit answers "is this number attached to the
    // humans-first engine?" and not just "what does Twilio point at?".
    const tail = phone.replace(/\D/g, "").slice(-10);
    const { data: dirRow } = await supabase
      .from("dc_phone_numbers")
      .select("id, phone_number, business, va_company_id, webhook_url, is_active")
      .ilike("phone_number", `%${tail}`)
      .maybeSingle();

    let routing: Record<string, unknown> = { attached_to_company: false };
    if (dirRow?.va_company_id) {
      const { data: company } = await supabase
        .from("va_companies").select("id, slug, name").eq("id", dirRow.va_company_id).maybeSingle();
      const { data: policy } = await supabase
        .from("inbound_policy").select("*").eq("va_company_id", dirRow.va_company_id).maybeSingle();
      const { data: targets } = await supabase
        .from("inbound_ring_targets")
        .select("label, target_type, ring_order, active, only_business_hours, user_id")
        .eq("va_company_id", dirRow.va_company_id)
        .order("ring_order");
      routing = {
        attached_to_company: true,
        company,
        policy,
        ring_targets: targets || [],
        human_ring_target_count: (targets || []).filter((t) => t.active).length,
      };
    }

    if (action === "audit") {
      return json({ ok: true, action: "audit", config: shape(num), directory: dirRow || null, routing });
    }
    if (action !== "apply") return json({ error: "bad_request", detail: `unknown action ${action}` }, 400);

    const before = shape(num);
    const voiceUrl = String(body.voice_url || `${SUPABASE_URL}/functions/v1/twilio-inbound-call`);
    const statusUrl = String(body.status_callback || `${SUPABASE_URL}/functions/v1/twilio-call-status`);
    for (const u of [voiceUrl, statusUrl]) {
      if (!u.startsWith(`${SUPABASE_URL}/functions/v1/`)) {
        return json({ error: "bad_request", detail: "urls must be endpoints in this project" }, 400);
      }
    }

    const form = new URLSearchParams({
      VoiceUrl: voiceUrl,
      VoiceMethod: "POST",
      VoiceFallbackUrl: voiceUrl,
      VoiceFallbackMethod: "POST",
      StatusCallback: statusUrl,
      StatusCallbackMethod: "POST",
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
      console.error(`[twilio-admin-voice-config] update failed [${updRes.status}]: ${updBody}`);
      return json({ error: "twilio_error", status: updRes.status, details: updBody }, updRes.status);
    }
    const after = shape(JSON.parse(updBody));

    await supabase
      .from("dc_phone_numbers")
      .update({ webhook_url: voiceUrl, twilio_webhook_configured: true, twilio_sid: num.sid, updated_at: new Date().toISOString() })
      .ilike("phone_number", `%${tail}`);

    console.log(`[twilio-admin-voice-config] ${phone} VoiceUrl ${before.voice_url ?? "none"} → ${after.voice_url}`);
    return json({ ok: true, action: "apply", before, after, routing });
  } catch (e) {
    console.error("[twilio-admin-voice-config] error", (e as Error).message);
    return json({ error: "internal_error", detail: (e as Error).message }, 500);
  }
});
