/**
 * GASMASK CALL DIAL-COMPLETE
 *
 * Fires as the <Dial action> callback. Decides what happens when the
 * primary ring leg ends:
 *   - answered  → mark the call answered/completed in the phone log
 *   - not answered:
 *       next=owner|va → ring the second leg (sequential ring models)
 *       otherwise     → record a voicemail (or hang up if VM disabled)
 *
 * A missed call is ALWAYS written to communication_logs so it can never
 * silently vanish from the phone log.
 */

import { corsHeaders, readForm, verifyTwilio, xmlHeaders, escapeXml, canonicalUrl } from "../_shared/dialer.ts";
import { voicemailTwiml } from "../_shared/voicemailTwiml.ts";
import {
  svcClient,
  loadRoutingSettings,
  loadAvailableVas,
  upsertCallLog,
  patchCallLog,
  normalizePhone,
  resolveBusinessId,
  loadOwnerContacts,
  loadOnShiftClients,
} from "../_shared/gasmaskVoice.ts";
import { runMissedCallRecovery } from "../_shared/gasmaskMissedRecovery.ts";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

const ANSWERED = new Set(["completed", "answered"]);

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
    console.error(`[gasmask-call-dial-complete] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "voicemail";

  const callSid = params.CallSid || "";
  const from = normalizePhone(params.From || "");
  const to = normalizePhone(params.To || "");
  const dialStatus = (params.DialCallStatus || "").toLowerCase();
  const dialDuration = parseInt(params.DialCallDuration || "0", 10) || 0;
  const answeredBy = normalizePhone(params.DialCallSid ? (params.To || "") : "");

  console.log(`[gasmask-call-dial-complete] sid=${callSid} status=${dialStatus} next=${next} dur=${dialDuration}`);

  const supabase = svcClient();

  // ── Answered: close the log entry out and end the call ──
  if (ANSWERED.has(dialStatus) && dialDuration > 0) {
    await patchCallLog(supabase, callSid, {
      status: "answered",
      outcome: "answered",
      call_duration: dialDuration,
      duration_seconds: dialDuration,
      answered_at: new Date(Date.now() - dialDuration * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      summary: `Answered inbound call (${dialDuration}s)`,
    });
    return twiml("<Hangup/>");
  }

  const settings = await loadRoutingSettings(supabase, "gasmask");
  const u = new URL(canonicalUrl(req));
  const base = `${u.protocol}//${u.host}/functions/v1`;

  const businessId = await resolveBusinessId(supabase, "gasmask");

  // ── Second leg for sequential ring models ──
  if (settings && (next === "owner" || next === "va")) {
    let legNumbers: string[] = [];
    let legClients: string[] = [];
    if (next === "owner") {
      const owners = await loadOwnerContacts(supabase, businessId);
      legNumbers = owners.length
        ? owners.map((o) => o.phone_e164)
        : (settings.owner_forward_number ? [settings.owner_forward_number] : []);
    } else {
      legNumbers = (await loadAvailableVas(supabase, "gasmask")).map((x) => x.forward_number);
      legClients = (await loadOnShiftClients(supabase, businessId)).map((c) => c.client_identity);
    }

    if (legNumbers.length + legClients.length) {
      await patchCallLog(supabase, callSid, {
        status: "ringing",
        summary: next === "owner" ? "Unanswered by VA — forwarding to owner" : "Unanswered by owner — forwarding to VA",
      });

      const recCb = `${base}/gasmask-call-recording-status`;
      // Recording consent gate — same rule as gasmask-inbound-voice. Fails closed.
      const { attr: consentAttr, decision: recDecision } = await recordAttrFor(supabase, from, {
        mode: "record-from-answer-dual",
        callbackUrl: recCb,
      });
      const recordAttrs = settings.recording_enabled ? consentAttr : "";
      console.log(`[gasmask-call-dial-complete] recording=${recordAttrs ? "on" : "off"} (enabled=${settings.recording_enabled}, ${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);
      const legs = [
        ...legNumbers.map((n) => `<Number>${escapeXml(n)}</Number>`),
        ...legClients.map((c) => `<Client>${escapeXml(c)}</Client>`),
      ].join("");

      return twiml(`
  <Dial answerOnBridge="true" timeout="${Math.min(25, Math.max(20, settings.owner_ring_timeout_seconds || 20))}" callerId="${escapeXml(to)}"
        action="${escapeXml(`${base}/gasmask-call-dial-complete?next=voicemail`)}" method="POST"${recordAttrs}>
    ${legs}
  </Dial>`);
    }
  }

  // ── Nobody answered: log the miss, then take a voicemail ──
  await upsertCallLog(supabase, {
    callSid,
    from,
    to,
    status: "missed",
    summary: `Missed inbound call from ${from} (${dialStatus || "no-answer"})`,
    extra: {
      outcome: "missed",
      ended_at: new Date().toISOString(),
      event_type: "missed_call",
      next_action: "Call back",
      follow_up_required: true,
    },
  });

  // Auto text the caller back from the same GasMask number + alert on-shift
  // staff. Fire-and-forget: recovery must never delay or break the TwiML.
  const recovery = runMissedCallRecovery(supabase, {
    caller: from,
    businessNumber: to,
    businessId,
    callSid,
  }).catch((e) => console.error("[gasmask-call-dial-complete] recovery failed", (e as Error).message));
  (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(recovery);

  // ── AI-agent fallback (preserves the legacy inbound behaviour) ──
  // Humans got first crack. Nobody picked up, so hand the caller to the
  // existing AI phone agent route (dc-inbound-call → Bland AI DID). That
  // route also fires gasmask-missed-call-handler, which sends the recovery
  // SMS and — with vm=1 — falls through to voicemail if the agent misses too.
  if ((settings?.no_answer_action ?? "ai_agent") === "ai_agent") {
    await patchCallLog(supabase, callSid, {
      summary: `No human answer (${dialStatus || "no-answer"}) — handing off to AI phone agent`,
    });
    const aiUrl = `${base}/dc-inbound-call?biz=gasmask&vm=${settings?.voicemail_enabled ? "1" : "0"}&stage=ai_fallback`;
    return twiml(`<Redirect method="POST">${escapeXml(aiUrl)}</Redirect>`);
  }

  if (!settings?.voicemail_enabled) {
    return twiml(`<Say voice="alice">Sorry we missed you. Please try again later.</Say><Hangup/>`);
  }

  return twiml(voicemailTwiml(base, settings.voicemail_greeting));
});
