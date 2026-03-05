import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const formData = await req.formData();
    const digits = formData.get("Digits")?.toString() || "";
    const speechResult = formData.get("SpeechResult")?.toString().toLowerCase() || "";
    const callSid = formData.get("CallSid")?.toString() || "";

    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id");

    console.log(`Gather Input - Digits: ${digits}, Speech: ${speechResult}, Agent: ${agentId}`);

    // Check for affirmation
    const isConfirmed =
      digits === "1" ||
      speechResult.includes("yes") ||
      speechResult.includes("yeah") ||
      speechResult.includes("sure") ||
      speechResult.includes("ready") ||
      speechResult.includes("connect") ||
      speechResult.includes("link");

    // 🔴 LATENCY FIX: Fire and forget the database log for the user's response
    if (callSid) {
      const transcriptText = digits ? `(Pressed ${digits})` : speechResult;
      if (transcriptText) {
        // We do NOT 'await' this. We let it run in the background.
        supabase
          .from("live_call_transcripts")
          .insert({
            call_sid: callSid,
            speaker: "caller",
            text: transcriptText,
            is_final: true,
          })
          .then(({ error }) => {
            if (error) console.error("Error logging caller transcript:", error);
          });
      }
    }

    let twiml = "";

    if (isConfirmed && agentId) {
      // 🔴 DASHBOARD VISIBILITY: Log that the transfer is starting (background)
      supabase
        .from("live_call_transcripts")
        .insert({
          call_sid: callSid,
          speaker: "ai",
          text: "[System: Transferring to ElevenLabs AI Agent...]",
          is_final: true,
        })
        .then(() => {});

      // 🔴 LATENCY FIX: We remove the <Say> "Connecting you now" block.
      // This saves several seconds of waiting for Twilio TTS to generate audio.
      const bridgeUrl = `${supabaseUrl}/functions/v1/twilio-elevenlabs-bridge?agent_id=${agentId}`;

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Redirect method="POST">${bridgeUrl}</Redirect>
        </Response>
      `;
    } else if (isConfirmed && !agentId) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Configuration error. No Agent ID found.</Say><Hangup/></Response>`;
    } else {
      // Not confirmed or ambiguous input - retry immediately
      // 🔴 LATENCY FIX: Shortened the error message
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Polly.Joanna">I didn't catch that.</Say>
        <Redirect method="POST">${url.toString()}</Redirect>
      </Response>`;
    }

    return new Response(twiml.trim(), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    console.error("Gather Webhook Error:", error);
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">An error occurred. Goodbye.</Say><Hangup/></Response>`;
    return new Response(fallbackTwiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
  }
});
