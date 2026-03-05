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

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // --- High Speed Persona Resolution ---
    let agentId = agentIdParam;
    let personaId: string | null = null;

    // Only hit the DB if we don't have an agentId or if brandKey is specifically provided
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

    // Build handoff URL
    const projectId = supabaseUrl.replace("https://", "").split(".")[0];
    const handoffUrl = `https://${projectId}.supabase.co/functions/v1/call-live-handoff`;

    // --- Call ElevenLabs API ---
    const registerResponse = await fetch("https://api.elevenlabs.io/v1/convai/twilio/register-call", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
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
        },
      }),
    });

    if (!registerResponse.ok) {
      throw new Error(`ElevenLabs API failed: ${registerResponse.status}`);
    }

    const responseData = await registerResponse.json();
    const { twiml, conversation_id } = responseData;

    // 🔴 LATENCY FIX: Persist data to DB in the background.
    // We return the TwiML to Twilio IMMEDIATELY without waiting for Supabase.
    if (conversation_id && callSid) {
      const updatePromise = supabase
        .from("call_recordings")
        .update({ elevenlabs_conversation_id: conversation_id })
        .eq("provider_call_sid", callSid);

      // Use EdgeRuntime.waitUntil if available, otherwise just don't await
      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined") {
        EdgeRuntime.waitUntil(updatePromise);
      } else {
        updatePromise.then(() => console.log("Background DB update done"));
      }
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
