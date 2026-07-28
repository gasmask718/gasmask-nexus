/**
 * GASMASK INBOUND VOICE — the store-facing call entry point.
 *
 * Routing model (config-driven via public.voice_routing_settings):
 *   1. Speak the recording disclosure BEFORE any recording starts.
 *   2. Ring targets:
 *        simultaneous → all available VA numbers + owner cell at once
 *        sequential   → VAs first, then owner (second leg in dial-complete)
 *        owner_first  → owner cell first, then VAs
 *      Outside business hours, or when no VA is toggled available,
 *      the call goes straight to the owner cell.
 *   3. No answer → gasmask-call-dial-complete records a voicemail.
 *
 * Every call writes a single communication_logs row (channel='call'),
 * so calls and texts share one timeline.
 */

import { corsHeaders, readForm, verifyTwilio, xmlHeaders, escapeXml, canonicalUrl } from "../_shared/dialer.ts";
import { voicemailTwiml } from "../_shared/voicemailTwiml.ts";
import {
  svcClient,
  loadRoutingSettings,
  loadAvailableVas,
  isWithinBusinessHours,
  upsertCallLog,
  normalizePhone,
} from "../_shared/gasmaskVoice.ts";

function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    headers: xmlHeaders,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[gasmask-inbound-voice] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const callSid = params.CallSid || "";
  const from = normalizePhone(params.From || "");
  const to = normalizePhone(params.To || "");

  const supabase = svcClient();
  const settings = await loadRoutingSettings(supabase, "gasmask");

  console.log(`[gasmask-inbound-voice] sid=${callSid} from=${from} to=${to}`);

  if (!settings || !settings.is_active) {
    await upsertCallLog(supabase, { callSid, from, to, status: "failed", summary: "Inbound call — routing not configured" });
    return twiml(`<Say voice="alice">We're sorry, this line is not currently accepting calls. Please try again later.</Say><Hangup/>`);
  }

  const u = new URL(canonicalUrl(req));
  const base = `${u.protocol}//${u.host}/functions/v1`;

  // ── Build the ring list ──
  const withinHours = isWithinBusinessHours(settings);
  const vas = withinHours ? await loadAvailableVas(supabase, "gasmask") : [];
  const owner = settings.owner_forward_number || "";
  const vaNumbers = vas.map((x) => x.forward_number);

  let targets: string[] = [];
  let routeNote = "";

  if (settings.ring_model === "simultaneous") {
    targets = owner ? [...vaNumbers, owner] : vaNumbers;
    routeNote = vaNumbers.length ? `simultaneous: ${vaNumbers.length} VA(s) + owner` : "owner only (no VA available)";
  } else if (settings.ring_model === "owner_first") {
    targets = owner ? [owner] : vaNumbers;
    routeNote = "owner first";
  } else {
    targets = vaNumbers.length ? vaNumbers : owner ? [owner] : [];
    routeNote = vaNumbers.length ? "sequential: VA leg" : "owner only (no VA available)";
  }
  if (!withinHours) routeNote += " (off hours)";

  await upsertCallLog(supabase, {
    callSid,
    from,
    to,
    status: "ringing",
    extra: {
      metadata: {
        route: routeNote,
        within_hours: withinHours,
        va_targets: vaNumbers,
        owner_target: owner || null,
        ring_model: settings.ring_model,
      },
    },
  });

  const disclosure = settings.recording_enabled && settings.disclosure_text
    ? `<Say voice="alice">${escapeXml(settings.disclosure_text)}</Say>`
    : "";

  // Nobody to ring → straight to voicemail.
  if (targets.length === 0) {
    if (!settings.voicemail_enabled) {
      await upsertCallLog(supabase, { callSid, from, to, status: "missed", summary: "Missed call — no route available" });
      return twiml(`${disclosure}<Say voice="alice">Sorry, no one is available right now. Please try again later.</Say><Hangup/>`);
    }
    return twiml(`${disclosure}${voicemailTwiml(base, settings.voicemail_greeting)}`);
  }

  // For sequential/owner_first, the dial-complete handler rings the second leg.
  const nextStage = settings.ring_model === "sequential" && vaNumbers.length && owner
    ? "owner"
    : settings.ring_model === "owner_first" && owner && vaNumbers.length
    ? "va"
    : "voicemail";

  const actionUrl = `${base}/gasmask-call-dial-complete?next=${nextStage}`;
  const recCb = `${base}/gasmask-call-recording-status`;
  const recordAttrs = settings.recording_enabled
    ? ` record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recCb)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : "";

  const numbers = targets.map((n) => `<Number>${escapeXml(n)}</Number>`).join("");

  return twiml(`${disclosure}
  <Dial answerOnBridge="true" timeout="${settings.va_ring_timeout_seconds}" callerId="${escapeXml(to)}"
        action="${escapeXml(actionUrl)}" method="POST"${recordAttrs}>
    ${numbers}
  </Dial>`);
});
