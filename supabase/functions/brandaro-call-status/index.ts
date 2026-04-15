import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Brandaro Call Status Webhook — receives status callbacks, recording URLs, and transcripts from Twilio.
 * Automatically fetches and formats transcripts when recordings complete.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const callLogId = url.searchParams.get("callLogId") || "";
    const event = url.searchParams.get("event") || "status";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const accountSid = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN")!;

    // Parse Twilio form data
    const formData = await req.formData();
    const callSid = (formData.get("CallSid") as string) || "";
    const callStatus = (formData.get("CallStatus") as string) || "";
    const duration = parseInt((formData.get("CallDuration") as string) || "0", 10);
    const recordingUrl = (formData.get("RecordingUrl") as string) || "";
    const recordingSid = (formData.get("RecordingSid") as string) || "";
    const recordingDuration = parseInt((formData.get("RecordingDuration") as string) || "0", 10);

    console.log(`[brandaro-call-status] event=${event} callLogId=${callLogId} callSid=${callSid} status=${callStatus} recordingUrl=${recordingUrl}`);

    // ── RECORDING COMPLETE ──
    if (event === "recording" && recordingUrl) {
      const fullRecordingUrl = `${recordingUrl}.mp3`;
      
      const updateData: Record<string, unknown> = {
        recording_url: fullRecordingUrl,
        recording_sid: recordingSid,
      };

      if (callLogId) {
        await supabase.from("va_call_logs").update(updateData).eq("id", callLogId);
      }

      // Fetch transcript from Twilio (auto-transcription)
      // Start transcription for the recording
      try {
        const transcriptRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}/Transcriptions.json`,
          {
            method: "POST",
            headers: {
              "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );

        if (transcriptRes.ok) {
          console.log(`[brandaro-call-status] Transcription requested for recording ${recordingSid}`);
          // Transcription will be fetched later by brandaro-sync-recordings
        } else {
          console.warn(`[brandaro-call-status] Transcription request failed: ${transcriptRes.status}`);
        }
      } catch (err) {
        console.warn("[brandaro-call-status] Transcription request error:", err);
      }

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { "Content-Type": "text/xml" } },
      );
    }

    // ── DIAL COMPLETE ──
    if (event === "dial-complete") {
      const dialCallStatus = (formData.get("DialCallStatus") as string) || callStatus;
      
      const updateData: Record<string, unknown> = {
        call_status: dialCallStatus === "completed" ? "completed" : dialCallStatus,
        call_sid: callSid,
      };

      if (duration > 0) updateData.duration_seconds = duration;

      if (callLogId) {
        await supabase.from("va_call_logs").update(updateData).eq("id", callLogId);
      }

      // Return empty TwiML (call is done)
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { "Content-Type": "text/xml" } },
      );
    }

    // ── NUMBER STATUS (ringing, answered, completed) ──
    if (event === "number-status") {
      if (callLogId && callStatus) {
        const mapped = callStatus === "in-progress" ? "connected" : callStatus;
        await supabase.from("va_call_logs").update({
          call_status: mapped,
          call_sid: callSid,
        }).eq("id", callLogId);
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ── GENERIC STATUS ──
    if (callLogId && callStatus) {
      await supabase.from("va_call_logs").update({
        call_status: callStatus,
        call_sid: callSid,
        ...(duration > 0 ? { duration_seconds: duration } : {}),
      }).eq("id", callLogId);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    console.error("[brandaro-call-status] Error:", error);
    return new Response("Error", { status: 500 });
  }
});
