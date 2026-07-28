/**
 * GASMASK CALL RECORDING STATUS
 *
 * <Dial recordingStatusCallback>. Attaches the recording to the call's
 * existing communication_logs row. We store the Twilio recording SID/URL —
 * playback always goes through the access-controlled play-twilio-recording
 * proxy, never the raw Twilio URL.
 */

import { corsHeaders, readForm, verifyTwilio } from "../_shared/dialer.ts";
import { svcClient, patchCallLog } from "../_shared/gasmaskVoice.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[gasmask-call-recording-status] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const callSid = params.CallSid || "";
  const recordingSid = params.RecordingSid || "";
  const recordingUrl = params.RecordingUrl || "";
  const duration = parseInt(params.RecordingDuration || "0", 10) || 0;

  console.log(`[gasmask-call-recording-status] sid=${callSid} rec=${recordingSid} dur=${duration}`);

  if (callSid && recordingSid) {
    const supabase = svcClient();
    await patchCallLog(supabase, callSid, {
      recording_url: recordingUrl || `https://api.twilio.com/2010-04-01/Recordings/${recordingSid}`,
      twilio_sid: recordingSid,
      ...(duration ? { call_duration: duration, duration_seconds: duration } : {}),
    });
  }

  return new Response("", { status: 204, headers: corsHeaders });
});
