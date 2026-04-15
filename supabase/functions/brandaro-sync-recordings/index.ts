import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Brandaro Sync Recordings — fetches recordings and transcripts from Twilio
 * for all Brandaro VA calls that are missing them.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const accountSid = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN")!;

    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: "Brandaro Twilio credentials not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const specificCallSid = body.call_sid;
    const brandароNumber = "+19292623850";

    let synced = 0;
    let transcribed = 0;

    if (specificCallSid) {
      const result = await syncCallRecording(supabase, accountSid, authToken, specificCallSid);
      if (result) synced++;
      if (result?.transcribed) transcribed++;
    } else {
      // Fetch recent calls from Twilio for the Brandaro number
      const [outboundCalls, inboundCalls] = await Promise.all([
        fetchTwilioCalls(accountSid, authToken, `From=${encodeURIComponent(brandароNumber)}`),
        fetchTwilioCalls(accountSid, authToken, `To=${encodeURIComponent(brandароNumber)}`),
      ]);

      const allCalls = [...outboundCalls, ...inboundCalls];

      for (const call of allCalls) {
        const result = await syncCallRecording(supabase, accountSid, authToken, call.sid, call);
        if (result) synced++;
        if (result?.transcribed) transcribed++;
      }

      // Also sync DB calls missing recordings
      const { data: dbCalls } = await supabase
        .from("va_call_logs")
        .select("id, call_sid")
        .eq("twilio_number", brandароNumber)
        .not("call_sid", "is", null)
        .is("recording_url", null)
        .limit(50);

      if (dbCalls) {
        for (const dbCall of dbCalls) {
          if (dbCall.call_sid) {
            const result = await syncCallRecording(supabase, accountSid, authToken, dbCall.call_sid);
            if (result) synced++;
            if (result?.transcribed) transcribed++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, synced, transcribed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[brandaro-sync-recordings] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchTwilioCalls(accountSid: string, authToken: string, queryParam: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json?${queryParam}&PageSize=50`,
      { headers: { "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`) } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.calls || [];
  } catch {
    return [];
  }
}

async function syncCallRecording(
  supabase: any,
  accountSid: string,
  authToken: string,
  callSid: string,
  twilioCallData?: any,
): Promise<{ transcribed: boolean } | null> {
  try {
    // Get recordings for this call
    const recRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}/Recordings.json`,
      { headers: { "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`) } },
    );

    if (!recRes.ok) return null;

    const recData = await recRes.json();
    const recordings = recData.recordings || [];

    if (recordings.length === 0) return null;

    const recording = recordings[0];
    const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recording.sid}.mp3`;
    const recordingSid = recording.sid;

    // Try to get transcript
    let transcript = null;
    try {
      const transRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}/Transcriptions.json`,
        { headers: { "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`) } },
      );

      if (transRes.ok) {
        const transData = await transRes.json();
        const transcriptions = transData.transcriptions || [];
        
        if (transcriptions.length > 0) {
          const trans = transcriptions[0];
          if (trans.status === "completed") {
            const fullTransRes = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Transcriptions/${trans.sid}.json`,
              { headers: { "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`) } },
            );
            if (fullTransRes.ok) {
              const fullData = await fullTransRes.json();
              transcript = formatTranscript(fullData.transcription_text, callSid);
            }
          } else if (trans.status === "in-progress") {
            console.log(`[sync] Transcription still in progress for ${recordingSid}`);
          }
        } else {
          // No transcription exists — request one
          console.log(`[sync] Requesting transcription for ${recordingSid}`);
          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}/Transcriptions.json`,
            {
              method: "POST",
              headers: {
                "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
            },
          );
        }
      }
    } catch (err) {
      console.warn(`[sync] Transcript fetch failed for ${recordingSid}:`, err);
    }

    // Update database
    const updateData: Record<string, unknown> = {
      recording_url: recordingUrl,
      recording_sid: recordingSid,
    };
    if (transcript) updateData.transcript = transcript;
    if (twilioCallData?.duration) updateData.duration_seconds = parseInt(twilioCallData.duration, 10);
    if (twilioCallData?.status === "completed") updateData.call_status = "completed";

    // Match by call_sid first
    const { data: matched, error } = await supabase
      .from("va_call_logs")
      .update(updateData)
      .eq("call_sid", callSid)
      .select("id");

    if (error) {
      console.warn(`[sync] DB update failed for ${callSid}:`, error.message);
    }

    // If no match by call_sid, try to match by Twilio data
    if (!matched || matched.length === 0) {
      // Create a new record if we have enough data
      if (twilioCallData) {
        const direction = twilioCallData.direction === "outbound-api" || twilioCallData.direction === "outbound-dial" 
          ? "outbound" : "inbound";
        
        await supabase.from("va_call_logs").insert({
          call_sid: callSid,
          twilio_number: "+19292623850",
          recording_url: recordingUrl,
          recording_sid: recordingSid,
          transcript: transcript,
          duration_seconds: twilioCallData.duration ? parseInt(twilioCallData.duration, 10) : null,
          call_status: twilioCallData.status || "completed",
          called_at: twilioCallData.date_created,
          direction,
        });
      }
    }

    return { transcribed: !!transcript };
  } catch (err) {
    console.warn(`[sync] Error syncing ${callSid}:`, err);
    return null;
  }
}

function formatTranscript(rawText: string, callSid: string): string {
  if (!rawText) return "";
  
  // Format the transcript with speaker identification
  // Twilio basic transcription is single-channel, so we label it
  const lines = rawText.split(/[.!?]+/).filter(l => l.trim());
  const formatted = lines.map((line, i) => {
    const speaker = i % 2 === 0 ? "Agent" : "Caller";
    return `[${speaker}]: ${line.trim()}`;
  }).join("\n");
  
  return formatted || rawText;
}
