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

import {
import { recordAttrFor } from "../_shared/recordingConsent.ts"; corsHeaders, readForm, verifyTwilio, xmlHeaders, escapeXml, canonicalUrl } from "../_shared/dialer.ts";
import { voicemailTwiml } from "../_shared/voicemailTwiml.ts";
import {
  svcClient,
  loadRoutingSettings,
  loadAvailableVas,
  isWithinBusinessHours,
  upsertCallLog,
  normalizePhone,
  resolveBusinessId,
  loadOwnerContacts,
  loadOnShiftClients,
  loadOnShiftPhones,
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
  const businessId = await resolveBusinessId(supabase, "gasmask");

  // Owner numbers are CONFIG, never literals in code (business_owner_contacts).
  const ownerContacts = await loadOwnerContacts(supabase, businessId);
  let ownerNumbers = ownerContacts.map((c) => c.phone_e164);
  if (!ownerNumbers.length && settings.owner_forward_number) {
    ownerNumbers = [settings.owner_forward_number]; // legacy fallback
  }

  // On-shift VAs: browser softphones (<Client>) + any legacy forward numbers.
  const clients = withinHours ? await loadOnShiftClients(supabase, businessId) : [];
  const vas = withinHours ? await loadAvailableVas(supabase, "gasmask") : [];
  // Presence rows that carry a dialable number but no softphone identity still ring.
  const shiftPhones = withinHours ? await loadOnShiftPhones(supabase, businessId) : [];
  const vaNumbers = Array.from(
    new Set([...vas.map((x) => x.forward_number), ...shiftPhones].filter(Boolean)),
  ).filter((n) => !ownerNumbers.includes(n));
  const clientIdentities = clients.map((c) => c.client_identity);

  let numberTargets: string[] = [];
  let clientTargets: string[] = [];
  let routeNote = "";

  if (settings.ring_model === "simultaneous") {
    numberTargets = [...vaNumbers, ...ownerNumbers];
    clientTargets = clientIdentities;
    routeNote = `simultaneous: ${clientIdentities.length} VA softphone(s) + ${vaNumbers.length} VA number(s) + ${ownerNumbers.length} owner number(s)`;
  } else if (settings.ring_model === "owner_first") {
    numberTargets = ownerNumbers.length ? ownerNumbers : vaNumbers;
    clientTargets = ownerNumbers.length ? [] : clientIdentities;
    routeNote = "owner first";
  } else {
    const hasVa = vaNumbers.length || clientIdentities.length;
    numberTargets = hasVa ? vaNumbers : ownerNumbers;
    clientTargets = hasVa ? clientIdentities : [];
    routeNote = hasVa ? "sequential: VA leg" : "owner only (no VA on shift)";
  }
  if (!withinHours) routeNote += " (off hours)";

  const totalTargets = numberTargets.length + clientTargets.length;

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
        va_client_targets: clientTargets,
        owner_targets: ownerNumbers,
        ring_model: settings.ring_model,
      },
    },
  });

  const disclosure = settings.recording_enabled && settings.disclosure_text
    ? `<Say voice="alice">${escapeXml(settings.disclosure_text)}</Say>`
    : "";

  // Nobody to ring → straight to voicemail.
  if (totalTargets === 0) {
    if (!settings.voicemail_enabled) {
      await upsertCallLog(supabase, { callSid, from, to, status: "missed", summary: "Missed call — no route available" });
      return twiml(`${disclosure}<Say voice="alice">Sorry, no one is available right now. Please try again later.</Say><Hangup/>`);
    }
    return twiml(`${disclosure}${voicemailTwiml(base, settings.voicemail_greeting)}`);
  }

  // For sequential/owner_first, the dial-complete handler rings the second leg.
  const hasVaLeg = vaNumbers.length + clientIdentities.length > 0;
  const nextStage = settings.ring_model === "sequential" && hasVaLeg && ownerNumbers.length
    ? "owner"
    : settings.ring_model === "owner_first" && ownerNumbers.length && hasVaLeg
    ? "va"
    : "voicemail";

  const actionUrl = `${base}/gasmask-call-dial-complete?next=${nextStage}`;
  const recCb = `${base}/gasmask-call-recording-status`;
  // Recording consent gate: recording_enabled is necessary but NOT sufficient.
  // The caller's jurisdiction must be known and one-party. Fails closed.
  const { attr: consentAttr, decision: recDecision } = await recordAttrFor(supabase, from, {
    mode: "record-from-answer-dual",
    callbackUrl: recCb,
  });
  const recordAttrs = settings.recording_enabled ? consentAttr : "";
  console.log(`[gasmask-inbound-voice] recording=${recordAttrs ? "on" : "off"} (enabled=${settings.recording_enabled}, ${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);

  // All legs live inside ONE <Dial> → Twilio rings them in parallel and
  // cancels the losers the moment someone answers.
  const legs = [
    ...numberTargets.map((n) => `<Number>${escapeXml(n)}</Number>`),
    ...clientTargets.map((c) => `<Client>${escapeXml(c)}</Client>`),
  ].join("");

  // Parallel ring window: 20–25s, then voicemail.
  const ringTimeout = Math.min(25, Math.max(20, settings.va_ring_timeout_seconds || 20));

  return twiml(`${disclosure}
  <Dial answerOnBridge="true" timeout="${ringTimeout}" callerId="${escapeXml(to)}"
        action="${escapeXml(actionUrl)}" method="POST"${recordAttrs}>
    ${legs}
  </Dial>`);
});
