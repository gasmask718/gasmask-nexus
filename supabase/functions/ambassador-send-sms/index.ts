// Ambassador outbound SMS via Twilio gateway.
// - Verifies caller is an active ambassador
// - Looks up ambassador's twilio_number (falls back to TWILIO_DEFAULT_FROM)
// - Sends SMS through the Twilio connector gateway
// - Persists the message row (ambassador-scoped) and an activity log entry
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

interface Body {
  store_id: string;
  to_phone: string;
  body: string;
  body_translated?: string | null;
  media_urls?: string[];
  template_id?: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const DEFAULT_FROM = Deno.env.get("TWILIO_DEFAULT_FROM") || Deno.env.get("TWILIO_PHONE_NUMBER");

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return json({ error: "missing_auth" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Auth + ambassador lookup
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  const { data: amb, error: ambErr } = await admin
    .from("ambassadors")
    .select("id, twilio_number, name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (ambErr) return json({ error: ambErr.message }, 500);
  if (!amb) return json({ error: "not_an_ambassador" }, 403);

  // 2. Validate body
  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body.store_id || !body.to_phone || !body.body) {
    return json({ error: "missing_fields" }, 400);
  }

  // 3. Confirm store is assigned to this ambassador
  const { data: assignment } = await admin
    .from("ambassador_assignments")
    .select("id")
    .eq("ambassador_id", amb.id)
    .eq("store_id", body.store_id)
    .eq("active", true)
    .maybeSingle();
  if (!assignment) return json({ error: "store_not_assigned" }, 403);

  const fromNumber = amb.twilio_number || DEFAULT_FROM;
  let twilioSid: string | null = null;
  let providerStatus = "queued";
  let providerError: string | null = null;

  // 4. Send via Twilio gateway (if creds present)
  if (LOVABLE_API_KEY && TWILIO_API_KEY && fromNumber) {
    try {
      const params = new URLSearchParams({
        To: body.to_phone,
        From: fromNumber,
        Body: body.body,
      });
      (body.media_urls || []).forEach((u) => params.append("MediaUrl", u));

      const twilioRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
      const tData = await twilioRes.json();
      if (!twilioRes.ok) {
        providerError = tData?.message || `Twilio ${twilioRes.status}`;
        providerStatus = "failed";
      } else {
        twilioSid = tData.sid;
        providerStatus = tData.status || "sent";
      }
    } catch (e) {
      providerError = (e as Error).message;
      providerStatus = "failed";
    }
  } else {
    providerStatus = "queued"; // No Twilio configured — still log the message
    providerError = !fromNumber ? "no_from_number" : "twilio_not_configured";
  }

  // 5. Persist message row (service role bypasses RLS but we set ambassador_id correctly)
  const { data: msgRow, error: insErr } = await admin
    .from("communication_messages")
    .insert({
      ambassador_id: amb.id,
      store_id: body.store_id,
      owner_user_id: userId,
      created_by: userId,
      direction: "outbound",
      channel: "sms",
      content: body.body,
      body_translated: body.body_translated || null,
      phone_number: body.to_phone,
      to_number: body.to_phone,
      from_number: fromNumber || null,
      status: providerStatus,
      provider_message_id: twilioSid,
      error_message: providerError,
      media_urls: body.media_urls || [],
      template_id: body.template_id || null,
      metadata: { sent_by_ambassador: amb.name },
    })
    .select()
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  // 6. Activity log
  await admin.from("ambassador_activity_log").insert({
    ambassador_id: amb.id,
    store_id: body.store_id,
    action_type: body.template_id ? "template_sent" : "sms_sent",
    metadata: { message_id: msgRow.id, template_id: body.template_id, status: providerStatus },
  });

  // 7. Template usage bump
  if (body.template_id) {
    await admin.rpc("noop").catch(() => {});
    await admin
      .from("ambassador_message_templates")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", body.template_id);
  }

  return json({ ok: true, message: msgRow, twilio_sid: twilioSid, provider_status: providerStatus, provider_error: providerError });
});
