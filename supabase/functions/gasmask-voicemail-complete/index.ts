/**
 * GASMASK VOICEMAIL COMPLETE
 *
 * <Record action> callback. The caller left a message: attach the audio to
 * the call's phone-log row and create a `voicemails` record. The transcript
 * arrives separately via gasmask-voicemail-transcription.
 */

import { corsHeaders, readForm, verifyTwilio, xmlHeaders } from "../_shared/dialer.ts";
import { svcClient, patchCallLog, matchCaller, normalizePhone } from "../_shared/gasmaskVoice.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[gasmask-voicemail-complete] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const callSid = params.CallSid || "";
  const from = normalizePhone(params.From || "");
  const to = normalizePhone(params.To || "");
  const recordingSid = params.RecordingSid || "";
  const recordingUrl = params.RecordingUrl || "";
  const duration = parseInt(params.RecordingDuration || "0", 10) || 0;

  console.log(`[gasmask-voicemail-complete] sid=${callSid} rec=${recordingSid} dur=${duration}s`);

  const supabase = svcClient();
  const match = await matchCaller(supabase, from);

  await patchCallLog(supabase, callSid, {
    status: "voicemail",
    outcome: "voicemail",
    event_type: "voicemail",
    recording_url: recordingUrl,
    twilio_sid: recordingSid,
    call_duration: duration,
    duration_seconds: duration,
    ended_at: new Date().toISOString(),
    follow_up_required: true,
    next_action: "Listen to voicemail and call back",
    summary: `Voicemail from ${match.store_name || match.contact_name || from} (${duration}s)`,
  });

  try {
    await supabase.from("voicemails").insert({
      store_id: match.store_id,
      contact_id: match.contact_id,
      caller_number: from,
      caller_name: match.contact_name || match.store_name,
      recording_url: recordingUrl,
      recording_sid: recordingSid,
      duration_seconds: duration,
      transcription_status: "pending",
      reason: "no_answer",
      status: "new",
      metadata: { call_sid: callSid, business: "gasmask", to_number: to },
    });
  } catch (e) {
    console.error("[gasmask-voicemail-complete] voicemail insert failed", (e as Error).message);
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say voice="alice">Thanks, we got your message. We'll call you right back.</Say><Hangup/></Response>`,
    { headers: xmlHeaders },
  );
});
