import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * TWILIO CALL STATUS WEBHOOK
 * 
 * This edge function receives call lifecycle events from Twilio:
 * - initiated
 * - ringing
 * - in-progress / answered
 * - completed
 * - busy
 * - no-answer
 * - failed
 * - canceled
 * 
 * It updates the database with call status and captures:
 * - Duration
 * - End reason
 * - Recording URLs
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Twilio statuses to our internal statuses
const STATUS_MAP: Record<string, string> = {
  "queued": "queued",
  "initiated": "initiated",
  "ringing": "ringing",
  "in-progress": "in_progress",
  "answered": "in_progress",
  "completed": "completed",
  "busy": "busy",
  "no-answer": "no_answer",
  "failed": "failed",
  "canceled": "canceled",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("📞 Call status webhook received");

  try {
    // Parse the form-urlencoded body from Twilio
    const formData = await req.formData();
    
    // Extract all Twilio fields
    const callSid = formData.get("CallSid")?.toString() || "";
    const parentCallSid = formData.get("ParentCallSid")?.toString() || null;
    const callStatus = formData.get("CallStatus")?.toString() || "";
    const from = formData.get("From")?.toString() || "";
    const to = formData.get("To")?.toString() || "";
    const direction = formData.get("Direction")?.toString() || "";
    const duration = formData.get("CallDuration")?.toString() || formData.get("Duration")?.toString() || "0";
    const recordingUrl = formData.get("RecordingUrl")?.toString() || null;
    const recordingSid = formData.get("RecordingSid")?.toString() || null;
    const recordingDuration = formData.get("RecordingDuration")?.toString() || null;
    const transcriptionText = formData.get("TranscriptionText")?.toString() || null;
    const sipResponseCode = formData.get("SipResponseCode")?.toString() || null;
    const errorCode = formData.get("ErrorCode")?.toString() || null;
    const errorMessage = formData.get("ErrorMessage")?.toString() || null;
    const timestamp = formData.get("Timestamp")?.toString() || new Date().toISOString();

    console.log(`📞 Call Status Update: SID=${callSid}, Status=${callStatus}, Duration=${duration}s`);

    if (!callSid) {
      console.error("❌ Missing CallSid");
      return new Response(
        JSON.stringify({ success: false, error: "Missing CallSid" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map status
    const dbStatus = STATUS_MAP[callStatus] || callStatus;
    const isTerminal = ["completed", "busy", "no_answer", "failed", "canceled"].includes(dbStatus);

    // Build update payload for call_recordings
    const recordingUpdate: Record<string, any> = {
      // Always update these
    };

    // Add recording info if present
    if (recordingUrl) {
      recordingUpdate.recording_url = recordingUrl;
    }
    if (recordingDuration) {
      recordingUpdate.recording_duration = parseInt(recordingDuration, 10);
    }

    // Add completion info if terminal status
    if (isTerminal) {
      recordingUpdate.completed_at = new Date().toISOString();
    }

    // 1. Update call_recordings by provider_call_sid
    const effectiveSid = parentCallSid || callSid;
    
    const { data: recording, error: recordingFindError } = await supabase
      .from("call_recordings")
      .select("id, manual_call_id")
      .eq("provider_call_sid", effectiveSid)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recordingFindError && recordingFindError.code !== "PGRST116") {
      console.error("❌ Error finding call recording:", recordingFindError);
    }

    if (recording) {
      // Update the recording entry
      if (Object.keys(recordingUpdate).length > 0) {
        const { error: updateError } = await supabase
          .from("call_recordings")
          .update(recordingUpdate)
          .eq("id", recording.id);

        if (updateError) {
          console.error("❌ Error updating call_recordings:", updateError);
        } else {
          console.log(`✅ Updated call_recordings: ${recording.id}`);
        }
      }

      // 2. Update manual_call_logs if we have the reference
      if (recording.manual_call_id) {
        const callLogUpdate: Record<string, any> = {
          status: dbStatus,
        };

        if (isTerminal) {
          callLogUpdate.ended_at = new Date().toISOString();
          callLogUpdate.duration_seconds = parseInt(duration, 10);
          
          // Map to outcome
          if (dbStatus === "completed") {
            callLogUpdate.outcome = "connected";
          } else if (dbStatus === "no_answer") {
            callLogUpdate.outcome = "no_answer";
          } else if (dbStatus === "busy") {
            callLogUpdate.outcome = "busy";
          } else if (dbStatus === "failed") {
            callLogUpdate.outcome = "failed";
            callLogUpdate.notes = errorMessage || `Error code: ${errorCode}`;
          } else if (dbStatus === "canceled") {
            callLogUpdate.outcome = "canceled";
          }
        }

        const { error: logUpdateError } = await supabase
          .from("manual_call_logs")
          .update(callLogUpdate)
          .eq("id", recording.manual_call_id);

        if (logUpdateError) {
          console.error("❌ Error updating manual_call_logs:", logUpdateError);
        } else {
          console.log(`✅ Updated manual_call_logs: ${recording.manual_call_id} → ${dbStatus}`);
        }
      }
    } else {
      // No existing record found - this might be an outbound call or delayed webhook
      console.log(`⚠️ No recording found for CallSid: ${effectiveSid}`);
      
      // Try to find by parent call sid or create a new orphan record
      if (parentCallSid) {
        const { data: parentRecording } = await supabase
          .from("call_recordings")
          .select("id, manual_call_id")
          .eq("provider_call_sid", callSid)
          .single();

        if (parentRecording) {
          console.log(`✅ Found recording via CallSid: ${parentRecording.id}`);
          // Update found record
          if (Object.keys(recordingUpdate).length > 0) {
            await supabase
              .from("call_recordings")
              .update(recordingUpdate)
              .eq("id", parentRecording.id);
          }
        }
      }
    }

    // 3. Log to communication audit (for timeline visibility)
    const auditPayload = {
      call_sid: callSid,
      parent_call_sid: parentCallSid,
      status: callStatus,
      db_status: dbStatus,
      from,
      to,
      direction,
      duration: parseInt(duration, 10),
      recording_url: recordingUrl,
      error_code: errorCode,
      error_message: errorMessage,
      timestamp,
    };

    // Write to a general audit/activity log if needed
    // For now we'll just log it
    console.log(`📝 Audit: ${JSON.stringify(auditPayload)}`);

    // Return success to Twilio (must respond quickly)
    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("❌ Error in call status handler:", error);
    
    // Still return 200 to prevent Twilio retries
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
