import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TRANSFER CHOICE WEBHOOK
 *
 * After the initial campaign script plays and the customer confirms interest,
 * this webhook asks: "Press 1 for AI Agent, Press 2 for Human Agent."
 *
 * Flow:
 *   twilio-outbound-call -> twilio-gather-webhook (confirms interest)
 *     -> THIS WEBHOOK (asks AI vs Human preference)
 *       -> Press 1: dial BLAND_INBOUND_NUMBER (AI agent via Bland AI)
 *       -> Press 2: check human_agent_line_status
 *         -> available: <Dial> the human number
 *         -> busy: TTS "You're in queue, position X" + <Enqueue> or hold music + poll
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;

  try {
    const formData = await req.formData();
    const digits = formData.get("Digits")?.toString() || "";
    const speechResult = formData.get("SpeechResult")?.toString().toLowerCase() || "";
    const callSid = formData.get("CallSid")?.toString() || "";
    const callerParty = formData.get("From")?.toString() || "";

    const url = new URL(req.url);
    const blandDid = Deno.env.get("BLAND_INBOUND_NUMBER") || "";
    const humanNumber = url.searchParams.get("human_number") || Deno.env.get("LIVE_HANDOFF_NUMBER") || "";
    const queueItemId = url.searchParams.get("queue_item_id") || "";
    const campaignId = url.searchParams.get("campaign_id") || "";

    console.log(`Transfer Choice - Digits: ${digits}, Speech: ${speechResult}, CallSid: ${callSid}`);

    // Log the caller's response
    if (callSid) {
      const transcriptText = digits ? `(Pressed ${digits})` : speechResult;
      if (transcriptText) {
        supabase.from("live_call_transcripts").insert({
          call_sid: callSid,
          speaker: "caller",
          text: `Transfer choice: ${transcriptText}`,
          is_final: true,
        }).then(({ error }) => { if (error) console.error("Transcript log error:", error); });
      }
    }

    // ── CHOICE 1: AI Agent ──
    const wantsAI = digits === "1" || speechResult.includes("ai") || speechResult.includes("one") || speechResult.includes("artificial");

    // ── CHOICE 2: Human Agent ──
    const wantsHuman = digits === "2" || speechResult.includes("human") || speechResult.includes("two") || speechResult.includes("person") || speechResult.includes("agent") || speechResult.includes("real");

    let twiml = "";

    if (wantsAI) {
      // Log transfer
      supabase.from("live_call_transcripts").insert({
        call_sid: callSid, speaker: "system",
        text: "[Customer chose AI Agent — bridging to Bland AI]", is_final: true,
      }).then(() => {});

      // Update queue item
      if (queueItemId) {
        supabase.from("outbound_call_queue").update({
          status: "transferred",
          notes: `[TRANSFER:bland_ai] AI Agent chosen by customer`,
          updated_at: new Date().toISOString(),
        }).eq("id", queueItemId).then(() => {});
      }

      if (!blandDid) {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Sorry, no AI agent is currently configured. Goodbye.</Say>
  <Hangup/>
</Response>`;
      } else {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Connecting you now.</Say>
  <Dial answerOnBridge="true" timeout="20"><Number>${blandDid}</Number></Dial>
  <Hangup/>
</Response>`;
      }

    } else if (wantsHuman) {
      if (!humanNumber) {
        const fallbackTwiml = blandDid
          ? `<Say voice="Polly.Matthew">Sorry, no human agent is currently configured. Let me connect you to our AI assistant instead.</Say>
  <Dial answerOnBridge="true" timeout="20"><Number>${blandDid}</Number></Dial>
  <Hangup/>`
          : `<Say voice="Polly.Matthew">Sorry, no agent is currently available. Goodbye.</Say><Hangup/>`;
        twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${fallbackTwiml}\n</Response>`;
      } else {
        // Check if human agent line is available
        const { data: lineStatus } = await supabase
          .from("human_agent_line_status")
          .select("*")
          .eq("phone_number", humanNumber)
          .maybeSingle();

        const isAvailable = !lineStatus || lineStatus.status === "available";

        if (isAvailable) {
          // Mark line as busy
          await supabase.from("human_agent_line_status").upsert({
            phone_number: humanNumber,
            status: "busy",
            current_call_sid: callSid,
            current_queue_item_id: queueItemId || null,
            busy_since: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "phone_number" });

          // Log transfer
          supabase.from("live_call_transcripts").insert({
            call_sid: callSid, speaker: "system",
            text: `[Customer chose Human Agent — transferring to ${humanNumber}]`, is_final: true,
          }).then(() => {});

          if (queueItemId) {
            supabase.from("outbound_call_queue").update({
              status: "transferred",
              notes: `[TRANSFER:human] Human Agent chosen by customer`,
              updated_at: new Date().toISOString(),
            }).eq("id", queueItemId).then(() => {});
          }

          const recordingCallback = `${supabaseUrl}/functions/v1/twilio-recording-callback`;
          const statusCallback = `${supabaseUrl}/functions/v1/twilio-call-status`;

          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Connecting you now.</Say>
  <Dial${recAttr} action="${supabaseUrl}/functions/v1/twilio-human-call-complete?phone_number=${encodeURIComponent(humanNumber)}&amp;queue_item_id=${encodeURIComponent(queueItemId)}" timeout="20">
    <Number statusCallback="${statusCallback}" statusCallbackEvent="initiated ringing answered completed">${humanNumber}</Number>
  </Dial>
  <Say voice="Polly.Matthew">The agent was unavailable. Goodbye.</Say>
  <Hangup/>
</Response>`;

        } else {
          // Human agent is BUSY — queue the caller
          // Count current queue position
          const { count } = await supabase
            .from("human_agent_call_queue")
            .select("id", { count: "exact", head: true })
            .eq("phone_number", humanNumber)
            .eq("status", "waiting");

          const position = (count || 0) + 1;

          // Insert into queue
          await supabase.from("human_agent_call_queue").insert({
            call_sid: callSid,
            queue_item_id: queueItemId || null,
            campaign_id: campaignId || null,
            phone_number: humanNumber,
            position,
            status: "waiting",
          });

          supabase.from("live_call_transcripts").insert({
            call_sid: callSid, speaker: "system",
            text: `[Human agent busy — caller queued at position ${position}]`, is_final: true,
          }).then(() => {});

          // Tell the caller they're in queue, then offer AI as alternative
          const retryUrl = `${supabaseUrl}/functions/v1/twilio-human-queue-hold?phone_number=${encodeURIComponent(humanNumber)}&amp;queue_item_id=${encodeURIComponent(queueItemId)}&amp;call_queue_id=pending`;

          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Our agent is currently assisting another customer. You are number ${position} in the queue.</Say>
  <Gather input="dtmf speech" action="${retryUrl}" numDigits="1" timeout="5">
    <Say voice="Polly.Matthew">If you'd like to speak with our AI assistant instead, press 1 or say A I. Otherwise, please stay on the line and we'll connect you shortly.</Say>
  </Gather>
  <Redirect method="POST">${retryUrl}</Redirect>
</Response>`;
        }
      }
    } else {
      // No valid choice — retry
      const selfUrl = url.toString();
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" action="${selfUrl}" numDigits="1" timeout="4" speechTimeout="2">
    <Say voice="Polly.Matthew">Press 1 for AI assistant, or press 2 for a human agent.</Say>
  </Gather>
  <Say voice="Polly.Matthew">Goodbye.</Say>
  <Hangup/>
</Response>`;
    }

    return new Response(twiml.trim(), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Transfer Choice Webhook Error:", error);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Matthew">An error occurred. Goodbye.</Say><Hangup/></Response>`;
    return new Response(fallback, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
  }
});
