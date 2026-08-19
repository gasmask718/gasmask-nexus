/**
 * GASMASK VOICEMAIL TRANSCRIPTION
 *
 * Twilio transcribeCallback. Writes the transcript onto the call's phone-log
 * row + the voicemails record, and (if enabled) texts the owner the
 * transcript so a missed store call is impossible to overlook.
 */

import { corsHeaders, readForm, verifyTwilio } from "../_shared/dialer.ts";
import {
  svcClient,
  patchCallLog,
  loadRoutingSettings,
  matchCaller,
  normalizePhone,
  sendSms,
} from "../_shared/gasmaskVoice.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[gasmask-voicemail-transcription] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const callSid = params.CallSid || "";
  const recordingSid = params.RecordingSid || "";
  const text = params.TranscriptionText || "";
  const status = (params.TranscriptionStatus || "").toLowerCase();
  const from = normalizePhone(params.From || "");
  const to = normalizePhone(params.To || "");

  console.log(`[gasmask-voicemail-transcription] sid=${callSid} status=${status} len=${text.length}`);

  const supabase = svcClient();

  await patchCallLog(supabase, callSid, {
    transcript: text || null,
    transcription: text || null,
    transcript_status: status || "completed",
    message_content: text || null,
  });

  if (recordingSid) {
    await supabase
      .from("voicemails")
      .update({ transcription: text || null, transcription_status: status || "completed" })
      .eq("recording_sid", recordingSid);
  }

  // Text the owner the transcript
  try {
    const settings = await loadRoutingSettings(supabase, "gasmask");
    if (settings?.sms_transcript_to_owner && settings.owner_forward_number && text && to) {
      const match = await matchCaller(supabase, from);
      const who = match.store_name || match.contact_name || from;
      await sendSms({
        from: to,
        to: settings.owner_forward_number,
        idempotencyKey: `gm-vm-${callSid ?? crypto.randomUUID()}`,
        sendClass: "workforce",
        body: `📞 Missed call + voicemail from ${who} (${from}):\n\n"${text.slice(0, 700)}"`,
      });
      console.log("[gasmask-voicemail-transcription] owner notified");
    }
  } catch (e) {
    console.error("[gasmask-voicemail-transcription] owner SMS failed", (e as Error).message);
  }

  return new Response("", { status: 204, headers: corsHeaders });
});
