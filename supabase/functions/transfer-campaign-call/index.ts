import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback if no agent_id provided
const DEFAULT_AGENT_ID = "agent_8601khrh92krfgrrdj6gqcdpwate";
const DEFAULT_AGENT_NAME = "GASMASK INVENTORY CHECK";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { call_sid, transfer_type, queue_item_id, campaign_id, human_number, agent_id, agent_name } = await req.json();

    if (!call_sid) throw new Error("call_sid is required");
    if (!transfer_type || !["elevenlabs", "human"].includes(transfer_type)) {
      throw new Error("transfer_type must be 'elevenlabs' or 'human'");
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call_sid}.json`;

    if (transfer_type === "elevenlabs") {
      // Use provided agent_id or fall back to default
      const resolvedAgentId = agent_id || DEFAULT_AGENT_ID;
      const resolvedAgentName = agent_name || DEFAULT_AGENT_NAME;

      // Redirect to ElevenLabs bridge with the selected agent ID
      const bridgeUrl = `${supabaseUrl}/functions/v1/twilio-elevenlabs-bridge?agent_id=${resolvedAgentId}`;

      const updateRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ Url: bridgeUrl }),
      });

      if (!updateRes.ok) {
        const errBody = await updateRes.text();
        throw new Error(`Twilio update failed [${updateRes.status}]: ${errBody}`);
      }

      // Update queue item with transfer info
      if (queue_item_id) {
        await supabase.from("outbound_call_queue").update({
          status: "transferred",
          notes: `[TRANSFER:elevenlabs] ${resolvedAgentName} (${resolvedAgentId})`,
          updated_at: new Date().toISOString(),
        }).eq("id", queue_item_id);
      }

      if (call_sid) {
        await supabase.from("live_call_transcripts").insert({
          call_sid,
          speaker: "system",
          text: `[TRANSFERRED to AI Agent: ${resolvedAgentName}]`,
          created_at: new Date().toISOString(),
        });
      }

      console.log(`✅ Transferred ${call_sid} to ElevenLabs agent ${resolvedAgentId} (${resolvedAgentName})`);
      return new Response(JSON.stringify({ 
        success: true, 
        transfer_type: "elevenlabs", 
        agent_id: resolvedAgentId,
        agent_name: resolvedAgentName,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Human agent — dial Google number with recording
      const targetNumber = human_number || Deno.env.get("LIVE_HANDOFF_NUMBER") || "";
      if (!targetNumber) throw new Error("No human agent number configured");

      const { data: lineStatus } = await supabase
        .from("human_agent_line_status")
        .select("status")
        .eq("phone_number", targetNumber)
        .maybeSingle();

      const isAvailable = !lineStatus || lineStatus.status === "available";

      if (!isAvailable) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Human agent is currently busy with another call",
          agent_busy: true 
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("human_agent_line_status").upsert({
        phone_number: targetNumber,
        status: "busy",
        current_call_sid: call_sid,
        current_queue_item_id: queue_item_id || null,
        busy_since: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "phone_number" });

      const recordingCallback = `${supabaseUrl}/functions/v1/twilio-recording-callback`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Please hold while we connect you to an agent.</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${recordingCallback}" recordingStatusCallbackMethod="POST" action="${supabaseUrl}/functions/v1/twilio-human-call-complete?phone_number=${encodeURIComponent(targetNumber)}&amp;queue_item_id=${encodeURIComponent(queue_item_id || "")}" timeout="30">
    <Number>${targetNumber}</Number>
  </Dial>
  <Say voice="Polly.Matthew">The agent was unavailable. Thank you for your time. Goodbye.</Say>
  <Hangup/>
</Response>`;

      const updateRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ Twiml: twiml }),
      });

      if (!updateRes.ok) {
        await supabase.from("human_agent_line_status").upsert({
          phone_number: targetNumber, status: "available",
          current_call_sid: null, current_queue_item_id: null,
          busy_since: null, updated_at: new Date().toISOString(),
        }, { onConflict: "phone_number" });
        const errBody = await updateRes.text();
        throw new Error(`Twilio update failed [${updateRes.status}]: ${errBody}`);
      }

      if (queue_item_id) {
        await supabase.from("outbound_call_queue").update({
          status: "transferred",
          notes: `[TRANSFER:human] ${targetNumber}`,
          updated_at: new Date().toISOString(),
        }).eq("id", queue_item_id);
      }

      if (call_sid) {
        await supabase.from("live_call_transcripts").insert({
          call_sid,
          speaker: "system",
          text: `[TRANSFERRED to Human Agent: ${targetNumber}]`,
          created_at: new Date().toISOString(),
        });
      }

      console.log(`✅ Transferred ${call_sid} to human agent ${targetNumber}`);
      return new Response(JSON.stringify({ success: true, transfer_type: "human" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Transfer error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
