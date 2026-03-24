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
    let agentId = url.searchParams.get("agent_id") || "";
    const queueItemId = url.searchParams.get("queue_item_id") || "";
    const campaignId = url.searchParams.get("campaign_id") || "";
    const humanNumber = url.searchParams.get("human_number") || Deno.env.get("LIVE_HANDOFF_NUMBER") || "";

    // Fallback: if no agent_id in URL but we have a campaign, look it up
    if (!agentId && campaignId) {
      const { data: camp } = await supabase
        .from("dialer_campaigns")
        .select("agent_id")
        .eq("id", campaignId)
        .maybeSingle();
      if (camp?.agent_id) {
        agentId = camp.agent_id;
        console.log(`Resolved agent_id from campaign: ${agentId}`);
      }
    }

    // Final fallback: use default Sales Introduction agent
    if (!agentId) {
      const { data: defaultAgent } = await supabase
        .from("elevenlabs_agents")
        .select("elevenlabs_agent_id")
        .not("elevenlabs_agent_id", "is", null)
        .eq("is_active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      if (defaultAgent?.elevenlabs_agent_id) {
        agentId = defaultAgent.elevenlabs_agent_id;
        console.log(`Using default agent: ${agentId}`);
      }
    }

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

    // Log caller's response (fire and forget)
    if (callSid) {
      const transcriptText = digits ? `(Pressed ${digits})` : speechResult;
      if (transcriptText) {
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
      // Customer confirmed interest — now ask them to choose AI or Human
      supabase
        .from("live_call_transcripts")
        .insert({
          call_sid: callSid,
          speaker: "ai",
          text: "[System: Customer confirmed — asking transfer preference]",
          is_final: true,
        })
        .then(() => {});

      const transferChoiceUrl = `${supabaseUrl}/functions/v1/twilio-transfer-choice-webhook?agent_id=${agentId}&amp;human_number=${encodeURIComponent(humanNumber)}&amp;queue_item_id=${encodeURIComponent(queueItemId)}&amp;campaign_id=${encodeURIComponent(campaignId)}`;

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" action="${transferChoiceUrl}" numDigits="1" timeout="4" speechTimeout="2">
    <Say voice="Polly.Matthew">We have two options. Press 1 for our AI assistant, or press 2 for a live agent.</Say>
  </Gather>
  <Say voice="Polly.Matthew">Connecting you to our AI assistant.</Say>
  <Redirect method="POST">${supabaseUrl}/functions/v1/twilio-elevenlabs-bridge?agent_id=${agentId}</Redirect>
</Response>`;
    } else if (isConfirmed && !agentId) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Configuration error. No Agent ID found.</Say><Hangup/></Response>`;
    } else {
      // Not confirmed — retry
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I didn't catch that.</Say>
  <Redirect method="POST">${url.toString()}</Redirect>
</Response>`;
    }

    return new Response(twiml.trim(), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error: unknown) {
    console.error("Gather Webhook Error:", error);
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">An error occurred. Goodbye.</Say><Hangup/></Response>`;
    return new Response(fallbackTwiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
  }
});
