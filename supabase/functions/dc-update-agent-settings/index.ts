import { corsHeaders } from "@supabase/supabase-js/cors";

/**
 * Update all Dynasty Connect ElevenLabs agents to optimal settings:
 *   Voice model: eleven_turbo_v2_5
 *   LLM: gpt-4o
 *   Stability: 0.45, Similarity: 0.75
 *   Temperature: 0.7, Max tokens: 120
 */

const OPTIMAL_VOICE = "pNInz6obpgDQGcFmaJgB"; // Adam
const OPTIMAL_MODEL = "eleven_turbo_v2_5";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect all DC agent IDs from env
    const agentEnvKeys = [
      "DC_INBOUND_AGENT_ID",
      "DC_SALES_AGENT_ID",
      "DC_FOLLOWUP_AGENT_ID",
      "DC_REACTIVATION_AGENT_ID",
    ];

    const agents = agentEnvKeys
      .map((key) => ({ key, id: Deno.env.get(key) || "" }))
      .filter((a) => a.id.length > 0);

    if (agents.length === 0) {
      return new Response(JSON.stringify({
        error: "No DC agent IDs configured in environment",
        checked: agentEnvKeys,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* optional body */ }

    const voiceId = (body.voice_id as string) || OPTIMAL_VOICE;

    const results: Record<string, unknown> = {};

    for (const agent of agents) {
      console.log(`🤖 Updating ${agent.key}: ${agent.id}`);

      // Update agent conversation config
      const updatePayload = {
        conversation_config: {
          tts: {
            model_id: OPTIMAL_MODEL,
            voice_id: voiceId,
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
            optimize_streaming_latency: 4,
          },
          agent: {
            llm: {
              model: "gpt-4o",
              temperature: 0.7,
              max_tokens: 120,
            },
          },
        },
      };

      const resp = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.id}`, {
        method: "PATCH",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      const data = await resp.json();
      results[agent.key] = {
        status: resp.status,
        success: resp.ok,
        response: resp.ok ? "Updated" : data,
      };

      if (!resp.ok) {
        console.error(`❌ Failed to update ${agent.key}:`, data);
      } else {
        console.log(`✅ ${agent.key} updated to turbo_v2_5 + GPT-4o`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      settings_applied: {
        voice_model: OPTIMAL_MODEL,
        voice_id: voiceId,
        stability: 0.45,
        similarity: 0.75,
        llm: "gpt-4o",
        temperature: 0.7,
        max_tokens: 120,
        latency_optimization: 4,
      },
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("dc-update-agent-settings error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
