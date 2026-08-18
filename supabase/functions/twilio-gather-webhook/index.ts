import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

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
    const twilioFrom = formData.get("From")?.toString() || "";
    const twilioTo = formData.get("To")?.toString() || "";

    const url = new URL(req.url);
    let agentId = url.searchParams.get("agent_id") || "";
    const queueItemId = url.searchParams.get("queue_item_id") || "";
    const campaignId = url.searchParams.get("campaign_id") || "";
    const humanNumber = url.searchParams.get("human_number") || Deno.env.get("LIVE_HANDOFF_NUMBER") || "";

    // Resolve agent_id if not provided
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

    // Final fallback: first active ElevenLabs agent
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

    // ═══ Resolve actual prospect phone number ═══
    // Twilio's <Redirect> may report our own number as both From and To.
    // Look up the real prospect number from the outbound_call_queue.
    let prospectNumber = "";
    let ourNumber = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER") || "";

    if (queueItemId) {
      const { data: queueItem } = await supabase
        .from("outbound_call_queue")
        .select("phone_number")
        .eq("id", queueItemId)
        .maybeSingle();
      if (queueItem?.phone_number) {
        prospectNumber = queueItem.phone_number;
        console.log(`Resolved prospect number from queue: ${prospectNumber}`);
      }
    }

    // Fallback: use Twilio's reported To if different from our number
    if (!prospectNumber) {
      if (twilioTo && twilioTo !== ourNumber) {
        prospectNumber = twilioTo;
      } else if (twilioFrom && twilioFrom !== ourNumber) {
        prospectNumber = twilioFrom;
      }
    }

    // Ensure our number is set
    if (!ourNumber) {
      ourNumber = twilioFrom || "+18776818621";
    }

    console.log(`Gather Input - Digits: ${digits}, Speech: ${speechResult}, Agent: ${agentId}, Prospect: ${prospectNumber}`);

    // Check for affirmation
    const isConfirmed =
      digits === "1" ||
      speechResult.includes("yes") ||
      speechResult.includes("yeah") ||
      speechResult.includes("sure") ||
      speechResult.includes("ready") ||
      speechResult.includes("connect") ||
      speechResult.includes("okay") ||
      speechResult.includes("go ahead") ||
      speechResult.includes("link");

    // Log caller's response
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
      // ═══ FAST TRANSFER: Immediately redirect to ElevenLabs bridge ═══
      console.log(`🚀 Fast transfer to ElevenLabs agent: ${agentId} | callSid: ${callSid} | prospect: ${prospectNumber}`);

      // Log the transfer event
      supabase
        .from("live_call_transcripts")
        .insert({
          call_sid: callSid,
          speaker: "system",
          text: `[FAST TRANSFER → ElevenLabs Agent ${agentId}]`,
          is_final: true,
        })
        .then(() => {});

      // Update queue item status to bridging
      if (queueItemId) {
        supabase
          .from("outbound_call_queue")
          .update({
            status: "bridging",
            notes: `[BRIDGE] Transferring to ElevenLabs agent ${agentId}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", queueItemId)
          .then(() => {});
      }

      // Pass phone numbers and call_sid explicitly to the bridge
      const bridgeParams = new URLSearchParams({
        agent_id: agentId,
        from_number: ourNumber,
        to_number: prospectNumber,
        call_sid: callSid,
      });
      const bridgeUrl = `${supabaseUrl}/functions/v1/twilio-elevenlabs-bridge?${bridgeParams.toString()}`;

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">One moment please.</Say>
  <Redirect method="POST">${bridgeUrl}</Redirect>
</Response>`;
    } else if (isConfirmed && !agentId) {
      // No agent configured — error
      console.error("No agent_id available for transfer");
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">I apologize, we're experiencing a technical issue. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;
    } else if (digits === "2" && humanNumber) {
      // User pressed 2 — transfer to human agent
      console.log(`📞 Transferring to human agent: ${humanNumber}`);
      const recordingCallback = `${supabaseUrl}/functions/v1/twilio-recording-callback`;
      const humanCompleteUrl = `${supabaseUrl}/functions/v1/twilio-human-call-complete?phone_number=${encodeURIComponent(humanNumber)}&amp;queue_item_id=${encodeURIComponent(queueItemId)}`;

      // Recording consent gate on the prospect (external party). Fails closed.
      const { attr: recAttr, decision: recDecision } = await recordAttrFor(supabase, prospectNumber || twilioFrom, {
        mode: "record-from-answer-dual",
        callbackUrl: recordingCallback,
      });
      console.log(`[twilio-gather-webhook] recording=${recAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Connecting you to a live agent now.</Say>
  <Dial${recAttr} action="${humanCompleteUrl}" timeout="30">
    <Number>${humanNumber}</Number>
  </Dial>
  <Say voice="Polly.Matthew">The agent was unavailable. Goodbye.</Say>
  <Hangup/>
</Response>`;
    } else {
      // Not confirmed — retry once
      const retryUrl = url.toString();
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" action="${retryUrl}" numDigits="1" timeout="4" speechTimeout="2">
    <Say voice="Polly.Matthew">Sorry, I didn't catch that. Press 1 or say yes to continue.</Say>
  </Gather>
  <Say voice="Polly.Matthew">We didn't receive a response. Goodbye.</Say>
  <Hangup/>
</Response>`;
    }

    return new Response(twiml.trim(), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error: unknown) {
    console.error("Gather Webhook Error:", error);
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Matthew">An error occurred. Goodbye.</Say><Hangup/></Response>`;
    return new Response(fallbackTwiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
  }
});
