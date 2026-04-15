import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Brandaro Sync Recordings — fetches recordings and transcripts from Twilio
 * for all Brandaro VA calls that are missing them.
 * 
 * Can be called:
 * - Manually from admin UI
 * - On a cron schedule
 * - For a specific call_sid
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
      // Sync a specific call
      const result = await syncCallRecording(supabase, accountSid, authToken, specificCallSid);
      if (result) synced++;
      if (result?.transcribed) transcribed++;
    } else {
      // Fetch recent calls from Twilio for the Brandaro number
      const callsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json?From=${encodeURIComponent(brandароNumber)}&PageSize=50`,
        {
          headers: {
            "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
          },
        },
      );

      if (!callsRes.ok) {
        throw new Error(`Twilio API error: ${callsRes.status} ${await callsRes.text()}`);
      }

      const callsData = await callsRes.json();
      const calls = callsData.calls || [];

      // Also fetch calls TO the Brandaro number (inbound)
      const inboundRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json?To=${encodeURIComponent(brandароNumber)}&PageSize=50`,
        {
          headers: {
            "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
          },
        },
      );

      if (inboundRes.ok) {
        const inboundData = await inboundRes.json();
        calls.push(...(inboundData.calls || []));
      }

      for (const call of calls) {
        const result = await syncCallRecording(supabase, accountSid, authToken, call.sid, call);
        if (result) synced++;
        if (result?.transcribed) transcribed++;
      }

      // Also sync calls in DB that have call_sid but no recording
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
      {
        headers: { "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`) },
      },
    );

    if (!recRes.ok) return null;

    const recData = await recRes.json();
    const recordings = recData.recordings || [];

    if (recordings.length === 0) return null;

    const recording = recordings[0];
    const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recording.sid}.mp3`;
    const recordingSid = recording.sid;

    // Get transcript
    let transcript = null;
    try {
      const transRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}/Transcriptions.json`,
        {
          headers: { "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`) },
        },
      );

      if (transRes.ok) {
        const transData = await transRes.json();
        const transcriptions = transData.transcriptions || [];
        if (transcriptions.length > 0 && transcriptions[0].status === "completed") {
          // Fetch full transcript text
          const fullTransRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Transcriptions/${transcriptions[0].sid}.json`,
            {
              headers: { "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`) },
            },
          );
          if (fullTransRes.ok) {
            const fullData = await fullTransRes.json();
            transcript = fullData.transcription_text;
          }
        }
      }
    } catch (err) {
      console.warn(`[sync] Transcript fetch failed for ${recordingSid}:`, err);
    }

    // Update database - match by call_sid
    const updateData: Record<string, unknown> = {
      recording_url: recordingUrl,
      recording_sid: recordingSid,
    };
    if (transcript) updateData.transcript = transcript;
    if (twilioCallData?.duration) updateData.duration_seconds = parseInt(twilioCallData.duration, 10);

    const { error } = await supabase
      .from("va_call_logs")
      .update(updateData)
      .eq("call_sid", callSid);

    if (error) {
      console.warn(`[sync] DB update failed for ${callSid}:`, error.message);
    }

    return { transcribed: !!transcript };
  } catch (err) {
    console.warn(`[sync] Error syncing ${callSid}:`, err);
    return null;
  }
}
