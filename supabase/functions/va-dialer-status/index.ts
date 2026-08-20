import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readForm, verifyTwilio } from "../_shared/dialer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const callLogId = url.searchParams.get("callLogId");
    const eventType = url.searchParams.get("event");

    // Parse form data from Twilio webhook — read ONCE, feeds both the
    // signature check and the logic below.
    const params: Record<string, string> = await readForm(req);

    // ── SIGNATURE VERIFICATION — fails closed ──
    // VA dialer calls can originate on the Brandaro sub-account, whose
    // callbacks are signed with that account's auth token.
    const v = verifyTwilio(req, params, {
      extraTokenEnvVars: ["BRANDARO_TWILIO_AUTH_TOKEN"],
    });
    if (!v.ok) {
      console.error(`[va-dialer-status] signature invalid: ${v.reason}`);
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }


    const callSid = params.CallSid || "";
    const callStatus = params.CallStatus || "";
    const duration = parseInt(params.CallDuration || "0", 10);
    const recordingUrl = params.RecordingUrl || null;
    const answeredBy = params.AnsweredBy || ""; // human, machine_start, machine_end_beep, etc.

    console.log(`va-dialer-status: SID=${callSid} status=${callStatus} answeredBy=${answeredBy} duration=${duration}`);

    // Find the call log by call_sid or callLogId
    let targetCallLogId = callLogId;

    if (!targetCallLogId && callSid) {
      const { data } = await supabaseAdmin
        .from("va_call_logs")
        .select("id, va_id")
        .eq("call_sid", callSid)
        .maybeSingle();
      if (data) targetCallLogId = data.id;
    }

    if (!targetCallLogId) {
      console.warn("No call log found for", { callSid, callLogId });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Get VA ID from call log
    const { data: callLogData } = await supabaseAdmin
      .from("va_call_logs")
      .select("va_id")
      .eq("id", targetCallLogId)
      .single();

    const vaId = callLogData?.va_id;

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      initiated: "initiated",
      ringing: "ringing",
      "in-progress": "connected",
      completed: "completed",
      busy: "busy",
      "no-answer": "no_answer",
      failed: "failed",
      canceled: "canceled",
    };

    const mappedStatus = statusMap[callStatus] || callStatus;

    const updateData: any = { call_status: mappedStatus };

    if (duration > 0) updateData.duration_seconds = duration;
    if (recordingUrl) updateData.recording_url = recordingUrl;

    // AMD: if machine detected, flag for voicemail
    if (answeredBy && answeredBy.startsWith("machine")) {
      updateData.voicemail_dropped = false; // VA can choose to drop VM
      updateData.call_status = "machine_detected";
    }

    await supabaseAdmin.from("va_call_logs").update(updateData).eq("id", targetCallLogId);

    // Update leaderboard on answer (human pickup)
    if (callStatus === "in-progress" && vaId && (!answeredBy || answeredBy === "human")) {
      await supabaseAdmin.rpc("upsert_leaderboard_stat", {
        p_va_id: vaId, p_field: "calls_answered", p_increment: 1,
      });
    }

    // Update talk time on completion
    if (callStatus === "completed" && vaId && duration > 0) {
      await supabaseAdmin.rpc("upsert_leaderboard_stat", {
        p_va_id: vaId, p_field: "total_talk_time_seconds", p_increment: duration,
      });

      // Trigger post-call analysis if recording exists
      if (recordingUrl) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        fetch(`${SUPABASE_URL}/functions/v1/va-post-call-analysis`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callLogId: targetCallLogId, recordingUrl, vaId }),
        }).catch(e => console.error("Failed to trigger post-call analysis:", e));
      }
    }

    // Dial-complete event (from TwiML action URL)
    if (eventType === "dial-complete") {
      // Return TwiML to hang up
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    return new Response("ok", { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error("va-dialer-status error:", err);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
