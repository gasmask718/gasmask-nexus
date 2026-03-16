import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { call_sid, transfer_type, queue_item_id, campaign_id, human_number } = await req.json();

    if (!call_sid) throw new Error("call_sid is required");
    if (!transfer_type || !["elevenlabs", "human"].includes(transfer_type)) {
      throw new Error("transfer_type must be 'elevenlabs' or 'human'");
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    let redirectUrl: string;

    if (transfer_type === "elevenlabs") {
      // Redirect to existing ElevenLabs bridge
      const bridgeBase = `${supabaseUrl}/functions/v1/twilio-elevenlabs-bridge`;
      // Pass campaign context so the bridge can resolve the right agent
      const params = new URLSearchParams();
      if (campaign_id) params.set("campaign_id", campaign_id);
      redirectUrl = `${bridgeBase}?${params.toString()}`;
    } else {
      // Human agent path — generate TwiML that dials the Google number with recording
      const targetNumber = human_number || Deno.env.get("LIVE_HANDOFF_NUMBER") || "";
      if (!targetNumber) throw new Error("No human agent number configured");

      const recordingCallback = `${supabaseUrl}/functions/v1/twilio-call-status`;
      
      // We'll use a TwiML Bin approach: redirect to a URL that serves TwiML
      // But Twilio's update API accepts a Twiml parameter directly
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Please hold while we connect you to an agent.</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${recordingCallback}" recordingStatusCallbackMethod="POST" timeout="30" callerId="${targetNumber}">
    <Number>${targetNumber}</Number>
  </Dial>
  <Say voice="Polly.Matthew">The agent was unavailable. Thank you for your time. Goodbye.</Say>
  <Hangup/>
</Response>`;

      // Use Twiml parameter directly instead of Url
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call_sid}.json`;
      const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

      const updateRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ Twiml: twiml }),
      });

      if (!updateRes.ok) {
        const errBody = await updateRes.text();
        throw new Error(`Twilio update failed [${updateRes.status}]: ${errBody}`);
      }

      // Update queue item and insert transcript marker
      if (queue_item_id) {
        await supabase.from("outbound_call_queue").update({
          status: "transferred",
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

      return new Response(JSON.stringify({ success: true, transfer_type: "human" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ElevenLabs path — redirect the call to the bridge URL
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call_sid}.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const updateRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Url: redirectUrl! }),
    });

    if (!updateRes.ok) {
      const errBody = await updateRes.text();
      throw new Error(`Twilio update failed [${updateRes.status}]: ${errBody}`);
    }

    // Update queue item
    if (queue_item_id) {
      await supabase.from("outbound_call_queue").update({
        status: "transferred",
        updated_at: new Date().toISOString(),
      }).eq("id", queue_item_id);
    }

    if (call_sid) {
      await supabase.from("live_call_transcripts").insert({
        call_sid,
        speaker: "system",
        text: "[TRANSFERRED to AI Agent (ElevenLabs)]",
        created_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true, transfer_type: "elevenlabs" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Transfer error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
