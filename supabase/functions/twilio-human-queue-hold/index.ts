import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * HUMAN QUEUE HOLD WEBHOOK
 * 
 * Called while a caller is waiting in queue for the human agent.
 * Checks if agent became available. If so, transfers. Otherwise, loops with hold music.
 * If caller presses 1, redirects to AI agent instead.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const formData = await req.formData();
    const digits = formData.get("Digits")?.toString() || "";
    const speechResult = formData.get("SpeechResult")?.toString().toLowerCase() || "";
    const callSid = formData.get("CallSid")?.toString() || "";
    const callerParty = formData.get("From")?.toString() || "";

    const url = new URL(req.url);
    const humanNumber = url.searchParams.get("phone_number") || "";
    const agentId = url.searchParams.get("agent_id") || "";
    const queueItemId = url.searchParams.get("queue_item_id") || "";

    // If caller pressed 1 — switch to AI
    const wantsAI = digits === "1" || speechResult.includes("ai") || speechResult.includes("one");

    if (wantsAI) {
      // Remove from queue
      await supabase.from("human_agent_call_queue")
        .update({ status: "abandoned", updated_at: new Date().toISOString() })
        .eq("call_sid", callSid)
        .eq("status", "waiting");

      supabase.from("live_call_transcripts").insert({
        call_sid: callSid, speaker: "system",
        text: "[Caller switched from queue to AI Agent]", is_final: true,
      }).then(() => {});

      const bridgeUrl = `${supabaseUrl}/functions/v1/twilio-elevenlabs-bridge?agent_id=${agentId}`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Connecting you to our AI assistant now.</Say>
  <Redirect method="POST">${bridgeUrl}</Redirect>
</Response>`;
      return new Response(twiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }

    // Check if agent is now available
    const { data: lineStatus } = await supabase
      .from("human_agent_line_status")
      .select("status")
      .eq("phone_number", humanNumber)
      .maybeSingle();

    if (!lineStatus || lineStatus.status === "available") {
      // Agent is free! Mark line as busy and connect
      await supabase.from("human_agent_line_status").upsert({
        phone_number: humanNumber,
        status: "busy",
        current_call_sid: callSid,
        current_queue_item_id: queueItemId || null,
        busy_since: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "phone_number" });

      // Remove from queue
      await supabase.from("human_agent_call_queue")
        .update({ status: "connecting", updated_at: new Date().toISOString() })
        .eq("call_sid", callSid)
        .eq("status", "waiting");

      if (queueItemId) {
        supabase.from("outbound_call_queue").update({
          status: "transferred",
          notes: `[TRANSFER:human] Connected after queue wait`,
          updated_at: new Date().toISOString(),
        }).eq("id", queueItemId).then(() => {});
      }

      const recordingCallback = `${supabaseUrl}/functions/v1/twilio-recording-callback`;
      const statusCallback = `${supabaseUrl}/functions/v1/twilio-call-status`;
      // Recording consent gate on the external caller. Fails closed.
      const { attr: recAttr, decision: recDecision } = await recordAttrFor(supabase, callerParty, {
        mode: "record-from-answer-dual",
        callbackUrl: recordingCallback,
      });
      console.log(`[twilio-human-queue-hold] recording=${recAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Great news! Our agent is now available. Connecting you now.</Say>
  <Dial${recAttr} action="${supabaseUrl}/functions/v1/twilio-human-call-complete?phone_number=${encodeURIComponent(humanNumber)}&amp;queue_item_id=${encodeURIComponent(queueItemId)}" timeout="30">
    <Number statusCallback="${statusCallback}" statusCallbackEvent="initiated ringing answered completed">${humanNumber}</Number>
  </Dial>
  <Say voice="Polly.Matthew">The agent was unavailable. Thank you for your time. Goodbye.</Say>
  <Hangup/>
</Response>`;
      return new Response(twiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }

    // Still busy — loop with hold message
    const selfUrl = `${supabaseUrl}/functions/v1/twilio-human-queue-hold?phone_number=${encodeURIComponent(humanNumber)}&amp;agent_id=${encodeURIComponent(agentId)}&amp;queue_item_id=${encodeURIComponent(queueItemId)}`;

    // Get queue position
    const { count } = await supabase
      .from("human_agent_call_queue")
      .select("id", { count: "exact", head: true })
      .eq("phone_number", humanNumber)
      .eq("status", "waiting")
      .lt("created_at", new Date().toISOString());

    const position = count || 1;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Our agent is still assisting another customer. You are number ${position} in queue.</Say>
  <Gather input="dtmf speech" action="${selfUrl}" numDigits="1" timeout="15">
    <Say voice="Polly.Matthew">Press 1 at any time to switch to our AI assistant.</Say>
    <Play>http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-B8686b.mp3</Play>
  </Gather>
  <Redirect method="POST">${selfUrl}</Redirect>
</Response>`;

    return new Response(twiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
  } catch (error) {
    console.error("Queue Hold Error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Goodbye.</Say><Hangup/></Response>`,
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }
});
