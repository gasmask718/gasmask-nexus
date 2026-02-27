import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse Twilio webhook (form-encoded or JSON)
    let callSid: string | null = null;
    let callStatus: string | null = null;
    let duration: string | null = null;
    let recordingUrl: string | null = null;
    let recordingSid: string | null = null;

    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      callSid = formData.get("CallSid") as string;
      callStatus = formData.get("CallStatus") as string;
      duration = formData.get("CallDuration") as string;
      recordingUrl = formData.get("RecordingUrl") as string;
      recordingSid = formData.get("RecordingSid") as string;
    } else {
      const body = await req.json();
      callSid = body.CallSid || body.call_sid;
      callStatus = body.CallStatus || body.call_status;
      duration = body.CallDuration || body.duration;
      recordingUrl = body.RecordingUrl || body.recording_url;
      recordingSid = body.RecordingSid || body.recording_sid;
    }

    if (!callSid || !callStatus) {
      return new Response(JSON.stringify({ error: "Missing CallSid or CallStatus" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[twilio-call-events] SID=${callSid} Status=${callStatus}`);

    // Map Twilio status to our state
    const stateMap: Record<string, string> = {
      queued: "queued",
      initiated: "dialing",
      ringing: "ringing",
      "in-progress": "answered",
      answered: "answered",
      completed: "completed",
      failed: "failed",
      busy: "failed",
      "no-answer": "failed",
      canceled: "failed",
    };

    const newState = stateMap[callStatus] || callStatus;

    const updatePayload: Record<string, any> = {
      state: newState,
      updated_at: new Date().toISOString(),
    };

    if (callStatus === "in-progress" || callStatus === "answered") {
      updatePayload.answered_at = new Date().toISOString();
    }

    if (callStatus === "completed" || callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer" || callStatus === "canceled") {
      updatePayload.ended_at = new Date().toISOString();
      if (duration) {
        updatePayload.duration_seconds = parseInt(duration, 10);
      }
    }

    if (recordingUrl) {
      updatePayload.recording_url = recordingUrl;
      updatePayload.recording_sid = recordingSid;
    }

    const { error } = await supabase
      .from("live_calls")
      .update(updatePayload)
      .eq("call_sid", callSid);

    if (error) {
      console.error("[twilio-call-events] Update failed:", error);
      // Try insert if no existing row (call may have been created externally)
    }

    // Return TwiML-compatible empty response for Twilio webhooks
    return new Response("<Response/>", {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[twilio-call-events] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
