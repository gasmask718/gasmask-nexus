// Ambassador outbound SMS via Twilio gateway.
// - Verifies caller is an active ambassador
// - Looks up ambassador's twilio_number (falls back to TWILIO_DEFAULT_FROM)
// - Sends SMS through the Twilio connector gateway
// - Persists the message row (ambassador-scoped) and an activity log entry
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verifiedInsertSoft } from "../_shared/verifiedWrite.ts";
import { sendSms, smsContentHash } from "../_shared/sendSms.ts";
import { captureQuickContact } from "../_shared/quickContact.ts";


interface Body {
  store_id?: string; // absent = quick-dial pad send to a raw street number
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

  // A single auth user can own several ambassador records (street-team
  // aliases), so maybeSingle() used to throw "multiple rows returned" and
  // kill the whole send — including the activity-log write. Fetch them all
  // and pick the one that actually owns the target store below.
  const { data: ambRows, error: ambErr } = await admin
    .from("ambassadors")
    .select("id, twilio_number, name")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (ambErr) return json({ error: ambErr.message }, 500);
  if (!ambRows || ambRows.length === 0) return json({ error: "not_an_ambassador" }, 403);

  // 2. Validate body
  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body.to_phone || !body.body) {
    return json({ error: "missing_fields" }, 400);
  }

  // 3. Resolve which ambassador record owns this send. Store sends must be
  //    assigned to the caller. Quick-dial sends (a street number with no store
  //    yet) have nothing to assign against — use the caller's first active
  //    ambassador record. Suppression still applies via sendSms either way.
  let amb: (typeof ambRows)[number];
  if (body.store_id) {
    const { data: assignments } = await admin
      .from("ambassador_assignments")
      .select("ambassador_id")
      .in("ambassador_id", ambRows.map((a) => a.id))
      .eq("store_id", body.store_id)
      .eq("active", true);
    const owningId = assignments?.[0]?.ambassador_id;
    if (!owningId) return json({ error: "store_not_assigned" }, 403);
    amb = ambRows.find((a) => a.id === owningId)!;
  } else {
    amb = ambRows[0];
  }

  const fromNumber = amb.twilio_number || DEFAULT_FROM;
  let twilioSid: string | null = null;
  let providerStatus = "queued";
  let providerError: string | null = null;

  // 4. Send through the canonical chokepoint.
  //    Class = conversational: a rep typing to one assigned store. It still
  //    honours suppression and the legal STOP, but it is not bulk marketing,
  //    so it does not sit behind the campaign cooldown or campaign budget.
  const sendRes = await sendSms({
    to: body.to_phone,
    body: body.body,
    idempotencyKey: `amb-sms-${amb.id}-${body.store_id || body.to_phone}-${await smsContentHash(body.body + Date.now())}`,
    sendClass: "conversational",
    from: fromNumber || undefined,
    mediaUrls: body.media_urls || [],
    storeId: body.store_id || undefined,
    purpose: "ambassador",
    metadata: { ambassador_id: amb.id, template_id: body.template_id || null, source: body.store_id ? "store_thread" : "quick_dial" },
  });

  if (sendRes.success) {
    twilioSid = sendRes.providerMessageId;
    providerStatus = "sent";
  } else {
    providerStatus = sendRes.blocked ? "blocked" : "failed";
    providerError = sendRes.errorMessage || sendRes.status;
  }

  // 5. Persist message row (service role bypasses RLS but we set ambassador_id correctly)
  const { data: msgRow, error: insErr } = await admin
    .from("communication_messages")
    .insert({
      ambassador_id: amb.id,
      store_id: body.store_id || null,
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

  // 5b. Mirror into the CANONICAL unified phone log so the owner sees
  //     ambassador texts alongside every other call/text for the store.
  const { error: mirrorErr } = await admin.from("communication_logs").insert({
    store_id: body.store_id || null,
    channel: "sms",
    direction: "outbound",
    status: providerStatus,
    delivery_status: providerStatus,
    message_content: body.body,
    sender_phone: fromNumber || null,
    recipient_phone: body.to_phone,
    sent_at: new Date().toISOString(),
    created_by: userId,
    ambassador_id: amb.id,
    twilio_message_sid: twilioSid,
    metadata: { source: "ambassador_portal", actor_name: amb.name, message_id: msgRow.id },
  });
  if (mirrorErr) console.error("[ambassador-send-sms] unified log mirror failed", mirrorErr);


  // 6. Activity log
  await verifiedInsertSoft(admin, 'log ambassador SMS', (c: any) => c.from("ambassador_activity_log").insert({
    ambassador_id: amb.id,
    store_id: body.store_id || null,
    action_type: body.template_id ? "template_sent" : "sms_sent",
    metadata: { message_id: msgRow.id, template_id: body.template_id, status: providerStatus },
  }));

  // 7. Template usage bump
  if (body.template_id) {
    await admin.rpc("noop").catch(() => {});
    await admin
      .from("ambassador_message_templates")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", body.template_id);
  }

  // Quick-dial: capture the number the moment the text fires (sent or
  //  suppressed — either way the ambassador met a person and the number matters).
  let quickContactId: string | null = null;
  if (!body.store_id) {
    quickContactId = await captureQuickContact(admin, {
      ambassadorId: amb.id, ambassadorName: amb.name, phone: body.to_phone, firstAction: "texted",
    });
  }

  return json({ ok: true, message: msgRow, twilio_sid: twilioSid, provider_status: providerStatus, provider_error: providerError, blocked: sendRes.blocked === true, quick_contact_id: quickContactId });
});
