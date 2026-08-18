import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

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
    const FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER") || "+18776818621";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    if (transfer_type === "elevenlabs") {
      const resolvedAgentId = agent_id || DEFAULT_AGENT_ID;
      const resolvedAgentName = agent_name || DEFAULT_AGENT_NAME;

      // ═══════════════════════════════════════════════════════════════
      // FIX: For browser-based manual calls, the call_sid is the PARENT
      // leg (browser ↔ Twilio). Redirecting it connects ElevenLabs to
      // the BROWSER, not the recipient. Instead we must:
      //   1. Look up the recipient's phone number from the queue item
      //   2. Create a NEW outbound call to the recipient with ElevenLabs bridge
      //   3. Hang up the old call so the browser disconnects cleanly
      // ═══════════════════════════════════════════════════════════════

      // Step 1: Get recipient phone number
      let recipientPhone = "";
      if (queue_item_id) {
        const { data: queueItem } = await supabase
          .from("outbound_call_queue")
          .select("phone_number, contact_name, business_id")
          .eq("id", queue_item_id)
          .single();
        if (queueItem?.phone_number) {
          recipientPhone = queueItem.phone_number;
        }
      }

      // If no queue item, try to get the "To" number from the Twilio call
      if (!recipientPhone) {
        try {
          const callInfoRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call_sid}.json`,
            { headers: { Authorization: authHeader } }
          );
          if (callInfoRes.ok) {
            const callInfo = await callInfoRes.json();
            // For Device SDK calls, the "To" is typically the TwiML app, 
            // so check child calls instead
            const childRes = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?ParentCallSid=${call_sid}`,
              { headers: { Authorization: authHeader } }
            );
            if (childRes.ok) {
              const childData = await childRes.json();
              const childCall = childData.calls?.[0];
              if (childCall?.to) {
                recipientPhone = childCall.to;
                console.log(`📞 Found recipient phone from child call: ${recipientPhone}`);
              }
            }
            // Fallback to parent call's To if no child
            if (!recipientPhone && callInfo.to && !callInfo.to.startsWith("client:")) {
              recipientPhone = callInfo.to;
            }
          }
        } catch (e) {
          console.warn("Failed to fetch call info from Twilio:", e);
        }
      }

      if (!recipientPhone) {
        throw new Error("Cannot determine recipient phone number for transfer");
      }

      // Normalize phone
      const digits = recipientPhone.replace(/\D/g, "");
      const toNumber = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+${digits}`;

      // Step 2: Create NEW outbound call to recipient with ElevenLabs bridge
      const bridgeUrl = `${supabaseUrl}/functions/v1/twilio-elevenlabs-bridge?agent_id=${resolvedAgentId}`;
      const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;

      const newCallParams = new URLSearchParams();
      newCallParams.append("To", toNumber);
      newCallParams.append("From", FROM_NUMBER);
      newCallParams.append("Url", bridgeUrl);
      newCallParams.append("StatusCallback", statusCallbackUrl);
      newCallParams.append("StatusCallbackMethod", "POST");
      newCallParams.append("StatusCallbackEvent", "initiated");
      newCallParams.append("StatusCallbackEvent", "ringing");
      newCallParams.append("StatusCallbackEvent", "answered");
      newCallParams.append("StatusCallbackEvent", "completed");
      newCallParams.append("Record", "true");
      newCallParams.append("RecordingChannels", "dual");
      newCallParams.append("RecordingStatusCallback", `${supabaseUrl}/functions/v1/twilio-recording-callback`);
      newCallParams.append("RecordingStatusCallbackMethod", "POST");
      newCallParams.append("Timeout", "30");

      const newCallRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
        {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
          body: newCallParams.toString(),
        }
      );

      if (!newCallRes.ok) {
        const errBody = await newCallRes.text();
        throw new Error(`Failed to create ElevenLabs transfer call [${newCallRes.status}]: ${errBody}`);
      }

      const newCallData = await newCallRes.json();
      const newCallSid = newCallData.sid;
      console.log(`✅ New ElevenLabs call created: ${newCallSid} → ${toNumber} (agent: ${resolvedAgentId})`);

      // Step 3: Hang up the old browser call gracefully
      try {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call_sid}.json`,
          {
            method: "POST",
            headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ Status: "completed" }),
          }
        );
        console.log(`📴 Old browser call ${call_sid} ended`);
      } catch (e) {
        console.warn(`⚠️ Failed to hang up old call (may already be disconnected):`, e);
      }

      // Step 4: Update queue item
      if (queue_item_id) {
        await supabase.from("outbound_call_queue").update({
          status: "transferred",
          twilio_call_sid: newCallSid, // Point to the new AI call
          notes: `[TRANSFER:elevenlabs] ${resolvedAgentName} (${resolvedAgentId}) | New SID: ${newCallSid}`,
          updated_at: new Date().toISOString(),
        }).eq("id", queue_item_id);
      }

      // Pre-create call_recordings row for the new call
      const { error: recordingError } = await supabase.from("call_recordings").insert({
        provider_call_sid: newCallSid,
        business_id: queue_item_id ? (await supabase.from("outbound_call_queue").select("business_id").eq("id", queue_item_id).single()).data?.business_id : null,
        direction: "outbound",
        status: "initiated",
        provider: "twilio",
        channels: "dual",
        from_number: FROM_NUMBER,
        to_number: toNumber,
        created_at: new Date().toISOString(),
      });
      if (recordingError) {
        console.warn(`⚠️ Recording pre-insert for transfer call (non-fatal): ${recordingError.message}`);
      }

      // Log transcript event
      if (newCallSid) {
        await supabase.from("live_call_transcripts").insert({
          call_sid: newCallSid,
          speaker: "system",
          text: `[TRANSFERRED to AI Agent: ${resolvedAgentName}] Recipient: ${toNumber}`,
          created_at: new Date().toISOString(),
        });
      }

      console.log(`✅ Transfer complete: ${call_sid} → ${newCallSid} (ElevenLabs agent ${resolvedAgentId})`);
      return new Response(JSON.stringify({ 
        success: true, 
        transfer_type: "elevenlabs", 
        agent_id: resolvedAgentId,
        agent_name: resolvedAgentName,
        new_call_sid: newCallSid,
        recipient: toNumber,
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

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call_sid}.json`;
      const recordingCallback = `${supabaseUrl}/functions/v1/twilio-recording-callback`;

      // Recording consent gate on the lead (external party). Fails closed.
      const { attr: recAttr, decision: recDecision } = await recordAttrFor(supabase, toNumber, {
        mode: "record-from-answer-dual",
        callbackUrl: recordingCallback,
      });
      console.log(`[transfer-campaign-call] recording=${recAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Please hold while we connect you to an agent.</Say>
  <Dial${recAttr} action="${supabaseUrl}/functions/v1/twilio-human-call-complete?phone_number=${encodeURIComponent(targetNumber)}&amp;queue_item_id=${encodeURIComponent(queue_item_id || "")}" timeout="30">
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
