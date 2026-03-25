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
    if (!ELEVENLABS_API_KEY) {
      console.error("[Bridge] ELEVENLABS_API_KEY not configured");
      return twimlError("Voice agent not configured.");
    }

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

    // ═══ PHONE NUMBER RESOLUTION ═══
    // Priority: query params > form data > env fallback
    // The gather webhook now passes these explicitly to avoid Twilio redirect issues.
    let fromNumber = url.searchParams.get("from_number") || "";
    let toNumber = url.searchParams.get("to_number") || "";
    let callSid = url.searchParams.get("call_sid") || url.searchParams.get("CallSid") || "";

    // Also try Twilio form data as secondary source
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      try {
        const formData = await req.formData();
        if (!callSid) callSid = formData.get("CallSid")?.toString() || "";
        if (!fromNumber) fromNumber = formData.get("From")?.toString() || "";
        if (!toNumber) toNumber = formData.get("To")?.toString() || "";
      } catch (e) {
        console.warn("[Bridge] Could not parse form data:", e);
      }
    }

    // Env fallback for our number
    const ourTwilioNumber = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER") || "+18776818621";
    if (!fromNumber) fromNumber = ourTwilioNumber;

    // ═══ CRITICAL: Ensure from and to are DISTINCT for ElevenLabs ═══
    // ElevenLabs requires from_number (mandatory) and rejects identical from/to.
    // If they're the same, look up the real prospect number from call_recordings.
    if (fromNumber && toNumber && fromNumber === toNumber) {
      console.warn(`[Bridge] ⚠️ From and To are identical (${fromNumber}). Looking up real prospect number...`);

      // Try to find the actual prospect number from call_recordings
      if (callSid) {
        const { data: recording } = await supabase
          .from("call_recordings")
          .select("from_number, to_number")
          .eq("provider_call_sid", callSid)
          .maybeSingle();

        if (recording) {
          // For outbound calls: from_number = our number, to_number = prospect
          if (recording.to_number && recording.to_number !== fromNumber) {
            toNumber = recording.to_number;
            console.log(`[Bridge] ✅ Resolved prospect number from call_recordings: ${toNumber}`);
          } else if (recording.from_number && recording.from_number !== toNumber) {
            fromNumber = recording.from_number;
            console.log(`[Bridge] ✅ Resolved our number from call_recordings: ${fromNumber}`);
          }
        }
      }

      // If still identical after lookup, use our Twilio number as from and clear to
      // but ElevenLabs requires both — use a placeholder approach
      if (fromNumber === toNumber) {
        console.warn(`[Bridge] Still identical after lookup. Using our number as from, keeping to as-is.`);
        fromNumber = ourTwilioNumber;
        // If to is also our number (self-test), we must still send it
      }
    }

    console.log(`[Bridge] Starting | agent=${agentId} | callSid=${callSid} | from=${fromNumber} | to=${toNumber}`);

    // Build handoff URL
    const projectId = supabaseUrl.replace("https://", "").split(".")[0];
    const handoffUrl = `https://${projectId}.supabase.co/functions/v1/call-live-handoff`;

    // --- Brandaro Voice Agent: Fetch dynamic system prompt ---
    let conversationOverride: any = undefined;
    if (brandароMode) {
      try {
        const promptResp = await supabase.functions.invoke("brandaro-voice-agent", {
          body: {
            action: "get_system_prompt",
            lead_name: decodeURIComponent(leadName),
            business_name: decodeURIComponent(businessName),
            business_type: decodeURIComponent(businessType),
          },
        });
        if (promptResp.data) {
          conversationOverride = {
            agent: {
              prompt: { prompt: promptResp.data.system_prompt },
              first_message: `Hey, is this the owner or manager at ${decodeURIComponent(businessName) || "the business"}?`,
            },
          };
          console.log(`🧠 Brandaro voice agent prompt loaded (${promptResp.data.system_prompt.length} chars)`);
        }
      } catch (e) {
        console.warn("⚠️ Failed to load Brandaro prompt, using default agent config:", e);
      }
    }

    // --- Build ElevenLabs register-call payload ---
    // CRITICAL: from_number is REQUIRED by ElevenLabs API (422 if missing)
    const registerBody: any = {
      agent_id: agentId,
      from_number: fromNumber,
      to_number: toNumber || fromNumber,
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

    console.log(`[Bridge] Calling ElevenLabs register-call | agent_id=${agentId} | from=${fromNumber} | to=${registerBody.to_number}`);

    // --- Call ElevenLabs API with retry ---
    let registerResponse: Response | null = null;
    let rawText = "";
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        registerResponse = await fetch("https://api.elevenlabs.io/v1/convai/twilio/register-call", {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(registerBody),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        rawText = await registerResponse.text();

        if (registerResponse.ok) {
          console.log(`[Bridge] ✅ ElevenLabs responded OK on attempt ${attempt + 1}`);
          break;
        }

        console.error(`[Bridge] ElevenLabs returned ${registerResponse.status} (attempt ${attempt + 1}): ${rawText.substring(0, 500)}`);

        // If it's a 4xx validation error, don't retry
        if (registerResponse.status >= 400 && registerResponse.status < 500) break;

      } catch (fetchErr: any) {
        console.error(`[Bridge] Fetch error (attempt ${attempt + 1}):`, fetchErr.message);
        if (attempt === maxRetries) {
          return twimlError("Voice agent connection timed out. Please try again.");
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!registerResponse || !registerResponse.ok) {
      console.error(`[Bridge] ❌ All attempts failed. Last response: ${rawText.substring(0, 300)}`);
      return twimlError("Could not connect to voice agent.");
    }

    // ElevenLabs returns TwiML XML directly (not JSON)
    let twiml = rawText;
    let conversationId: string | null = null;

    // Try JSON first (legacy format)
    try {
      const jsonData = JSON.parse(rawText);
      twiml = jsonData.twiml || rawText;
      conversationId = jsonData.conversation_id || jsonData.conversationId || null;
      console.log("[Bridge] Parsed JSON response, conversation_id:", conversationId);
    } catch {
      // It's XML/TwiML — extract conversation_id from Parameter tag
      const match = rawText.match(/name="conversation_id"\s+value="([^"]+)"/);
      conversationId = match?.[1] || null;
      console.log("[Bridge] Parsed TwiML XML, extracted conversation_id:", conversationId);
    }

    console.log(`[Bridge] ✅ conversationId=${conversationId} | callSid=${callSid}`);

    // Persist conversation_id to call_recordings
    if (conversationId && callSid) {
      const { data: updated, error: updateErr } = await supabase
        .from("call_recordings")
        .update({ elevenlabs_conversation_id: conversationId })
        .eq("provider_call_sid", callSid)
        .select("id");

      if (updateErr) {
        console.error("[Bridge] UPDATE failed:", JSON.stringify(updateErr));
      }

      if (!updated || updated.length === 0) {
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
    return twimlError("Connection error. Please try again.");
  }
};

function twimlError(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Matthew">${message}</Say><Hangup/></Response>`,
    {
      status: 200,
      headers: { "Content-Type": "text/xml", ...corsHeaders },
    }
  );
}

serve(handler);
