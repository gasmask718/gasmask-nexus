import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * TWILIO ↔ ELEVENLABS BRIDGE (K.1 Enhanced)
 *
 * Twilio hits this URL when an outbound call connects.
 * This function:
 *  1. Reads the agent_id (or brand_key) from the query string
 *  2. Looks up the voice_matrix persona for the brand
 *  3. Parses From / To from Twilio's form-encoded POST body
 *  4. Calls ElevenLabs Register Call API with the persona's agent/voice config
 *  5. Logs a tts_event for latency tracking
 *  6. Returns the TwiML that ElevenLabs provides back to Twilio
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const agentIdParam = url.searchParams.get("agent_id");
    const brandKey = url.searchParams.get("brand_key");
    const handoffNumber = url.searchParams.get("handoff_number") || Deno.env.get("LIVE_HANDOFF_NUMBER") || "";

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY not configured");
      return twimlError("Sorry, the AI agent could not be connected. Missing API key.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // --- Persona resolution from voice_matrix ---
    let agentId = agentIdParam;
    let personaId: string | null = null;

    if (brandKey) {
      const { data: persona, error: personaError } = await supabase
        .from("voice_matrix")
        .select("id, elevenlabs_agent_id, elevenlabs_voice_id, persona_name, speaking_style")
        .eq("brand_key", brandKey)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (personaError) {
        console.error("❌ voice_matrix lookup error:", personaError.message);
      }

      if (persona) {
        personaId = persona.id;
        // Prefer the agent_id from voice_matrix if present
        if (persona.elevenlabs_agent_id) {
          agentId = persona.elevenlabs_agent_id;
        }
        console.log(`🎭 Persona resolved: ${persona.persona_name} (brand=${brandKey}, agentId=${agentId})`);
      } else {
        console.warn(`⚠️ No active persona found for brand_key=${brandKey}, falling back to agent_id param`);
      }
    }

    if (!agentId) {
      console.error("❌ Missing agent_id — no query param or voice_matrix match");
      return twimlError("Sorry, the AI agent could not be connected. Missing agent configuration.");
    }

    // Parse Twilio form-encoded body
    const formData = await req.formData();
    const fromNumber = formData.get("From")?.toString() || "";
    const toNumber = formData.get("To")?.toString() || "";
    const callSid = formData.get("CallSid")?.toString() || "";

    console.log(`🔗 Bridge: CallSid=${callSid}, From=${fromNumber}, To=${toNumber}, AgentId=${agentId}, Brand=${brandKey || "(none)"}`);

    // Build handoff URL
    const projectId = supabaseUrl.replace("https://", "").split(".")[0];
    const handoffUrl = `https://${projectId}.supabase.co/functions/v1/call-live-handoff`;

    // --- Call ElevenLabs with latency tracking ---
    const registerStart = Date.now();

    const registerResponse = await fetch(
      "https://api.elevenlabs.io/v1/convai/twilio/register-call",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: agentId,
          from_number: fromNumber,
          to_number: toNumber,
          direction: "outbound",
          dynamic_variables: {
            call_sid: callSid,
            handoff_url: handoffUrl,
            handoff_number: handoffNumber,
            interest_keywords: "I am the owner,yes I'm interested,tell me more,sign me up,I'd like to try,how do I start,sounds good,let's do it",
          },
        }),
      },
    );

    const latencyMs = Date.now() - registerStart;

    // Log TTS event for latency monitoring
    try {
      await supabase.from("tts_events").insert({
        provider: "elevenlabs",
        latency_ms: latencyMs,
        success: registerResponse.ok,
        was_fallback: false,
        persona_id: personaId,
        error_message: registerResponse.ok ? null : `HTTP ${registerResponse.status}`,
      });
    } catch (e) {
      console.warn("⚠️ Failed to log tts_event:", e);
    }

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error(`❌ ElevenLabs Register Call failed (${registerResponse.status}, ${latencyMs}ms):`, errorText);
      return twimlError("Sorry, the AI agent could not be connected. Please try again later.");
    }

    console.log(`⏱️ ElevenLabs register-call latency: ${latencyMs}ms`);

    // Parse response
    const responseData = await registerResponse.json();
    const twiml = responseData.twiml;
    const conversationId = responseData.conversation_id ?? responseData.conversationId ?? null;

    // Persist conversation_id + voice_matrix_id on the call recording
    if (conversationId || personaId) {
      try {
        const updatePayload: Record<string, unknown> = {};
        if (conversationId) updatePayload.elevenlabs_conversation_id = conversationId;

        const { error: convoUpdateError } = await supabase
          .from("call_recordings")
          .update(updatePayload)
          .eq("provider_call_sid", callSid);

        if (convoUpdateError) {
          console.error("❌ Failed to persist conversation data:", convoUpdateError);
        } else {
          console.log(`🧾 Stored conversation_id=${conversationId} for CallSid=${callSid}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("❌ Error persisting conversation_id:", msg);
      }
    }

    if (!twiml) {
      console.error("❌ ElevenLabs response missing twiml field:", JSON.stringify(responseData));
      return twimlError("Sorry, the AI agent returned an unexpected response.");
    }

    console.log(`✅ ElevenLabs returned TwiML (${twiml.length} bytes, ${latencyMs}ms)`);

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Bridge error:", msg);
    return twimlError("An error occurred connecting the AI agent.");
  }
};

function twimlError(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${message}</Say><Hangup/></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } },
  );
}

serve(handler);
