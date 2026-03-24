import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const agentIdParam = url.searchParams.get("agent_id");
    const brandKey = url.searchParams.get("brand_key");
    const handoffNumber = url.searchParams.get("handoff_number") || Deno.env.get("LIVE_HANDOFF_NUMBER") || "";
    const brandароMode = url.searchParams.get("brandaro_mode") === "true";
    const leadId = url.searchParams.get("lead_id") || "";
    const leadName = url.searchParams.get("lead_name") || "";
    const businessName = url.searchParams.get("business_name") || "";
    const businessType = url.searchParams.get("business_type") || "";

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // --- High Speed Persona Resolution ---
    let agentId = agentIdParam;
    let personaId: string | null = null;

    if (brandKey && !agentId) {
      const { data: persona } = await supabase
        .from("voice_matrix")
        .select("id, elevenlabs_agent_id")
        .eq("brand_key", brandKey)
        .eq("active", true)
        .maybeSingle();

      if (persona) {
        personaId = persona.id;
        agentId = persona.elevenlabs_agent_id || agentId;
      }
    }

    if (!agentId) return twimlError("Agent configuration missing.");

    // Parse Twilio body
    const formData = await req.formData();
    const fromNumber = formData.get("From")?.toString() || "";
    const toNumber = formData.get("To")?.toString() || "";
    const callSid = formData.get("CallSid")?.toString() || "";

    console.log(`[Bridge] Starting | agent=${agentId} | callSid=${callSid} | from=${fromNumber} | to=${toNumber}`);

    // Build handoff URL
    const projectId = supabaseUrl.replace("https://", "").split(".")[0];
    const handoffUrl = `https://${projectId}.supabase.co/functions/v1/call-live-handoff`;

    // --- Brandaro Voice Agent: Fetch dynamic system prompt ---
    let conversationOverride: any = undefined;
    if (brandароMode) {
      try {
        const promptResp = await fetch(`${supabaseUrl}/functions/v1/brandaro-voice-agent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceRoleKey}`,
          },
          body: JSON.stringify({
            action: "get_system_prompt",
            lead_name: decodeURIComponent(leadName),
            business_name: decodeURIComponent(businessName),
            business_type: decodeURIComponent(businessType),
          }),
        });
        if (promptResp.ok) {
          const promptData = await promptResp.json();
          conversationOverride = {
            agent: {
              prompt: { prompt: promptData.system_prompt },
              first_message: `Hey, is this the owner or manager at ${decodeURIComponent(businessName) || "the business"}?`,
            },
          };
          console.log(`🧠 Brandaro voice agent prompt loaded (${promptData.system_prompt.length} chars)`);
        }
      } catch (e) {
        console.warn("⚠️ Failed to load Brandaro prompt, using default agent config:", e);
      }
    }

    // --- Call ElevenLabs API ---
    const registerBody: any = {
      agent_id: agentId,
      from_number: fromNumber,
      to_number: toNumber,
      direction: "outbound",
      dynamic_variables: {
        call_sid: callSid,
        handoff_url: handoffUrl,
        handoff_number: handoffNumber,
        lead_id: leadId,
        business_name: decodeURIComponent(businessName),
      },
    };

    if (conversationOverride) {
      registerBody.conversation_config_override = conversationOverride;
    }

    console.log(`[Bridge] Calling ElevenLabs register-call with agent_id=${agentId}`);

    const registerResponse = await fetch("https://api.elevenlabs.io/v1/convai/twilio/register-call", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerBody),
    });

    // Read raw response for debugging
    const rawText = await registerResponse.text();

    if (!registerResponse.ok) {
      console.error(`[Bridge] ElevenLabs returned ${registerResponse.status}: ${rawText.substring(0, 500)}`);
      console.error(`[Bridge] Request body was: ${JSON.stringify(registerBody)}`);
      throw new Error(`ElevenLabs API failed: ${registerResponse.status} - ${rawText.substring(0, 200)}`);
    }

    let responseData: any = {};
    try {
      responseData = JSON.parse(rawText);
    } catch {
      console.error("[Bridge] ElevenLabs returned non-JSON:", rawText.substring(0, 200));
    }

    console.log("[Bridge] ElevenLabs full response keys:", Object.keys(responseData));

    const twiml = responseData.twiml;

    // Try every possible field name for conversation_id
    const conversationId =
      responseData.conversation_id ||
      responseData.conversationId ||
      responseData.id ||
      null;

    console.log(`[Bridge] Extracted conversationId=${conversationId} | callSid=${callSid}`);

    // Persist conversation_id to call_recordings
    if (conversationId && callSid) {
      // Try UPDATE first (row may already exist from outbound-call-trigger)
      const { data: updated, error: updateErr } = await supabase
        .from("call_recordings")
        .update({ elevenlabs_conversation_id: conversationId })
        .eq("provider_call_sid", callSid)
        .select("id");

      if (updateErr) {
        console.error("[Bridge] UPDATE failed:", JSON.stringify(updateErr));
      }

      if (!updated || updated.length === 0) {
        // No existing row — INSERT a new one
        console.log("[Bridge] No existing row found, inserting new call_recordings row");
        const { error: insertErr } = await supabase
          .from("call_recordings")
          .insert({
            provider_call_sid: callSid,
            elevenlabs_conversation_id: conversationId,
            provider: "elevenlabs",
            status: "in-progress",
            direction: "outbound",
            from_number: fromNumber,
            to_number: toNumber,
            has_transcript: false,
            started_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          });

        if (insertErr) {
          console.error("[Bridge] INSERT also failed:", JSON.stringify(insertErr));
        } else {
          console.log("[Bridge] ✅ conversation_id stored via INSERT");
        }
      } else {
        console.log("[Bridge] ✅ conversation_id stored via UPDATE");
      }
    } else {
      console.warn(`[Bridge] Missing data — conversationId=${conversationId}, callSid=${callSid}`);
    }

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Bridge error:", error.message);
    return twimlError("Connection error.");
  }
};

function twimlError(message: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>${message}</Say><Hangup/></Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml", ...corsHeaders },
  });
}

serve(handler);
