import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript_chunk, personality_id, lead_type, objection, context, lead_heat_score } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch personality profile
    let personality: any = null;
    if (personality_id) {
      const { data } = await supabase
        .from("brandaro_personalities")
        .select("*")
        .eq("id", personality_id)
        .single();
      personality = data;
    }

    // If no personality specified, auto-select based on lead type
    if (!personality) {
      const toneMap: Record<string, string> = {
        skeptical: "logical",
        emotional: "energetic",
        high_intent: "aggressive",
        luxury: "calm",
        budget: "confident",
      };
      const targetTone = toneMap[lead_type || ""] || "confident";
      const { data } = await supabase
        .from("brandaro_personalities")
        .select("*")
        .eq("tone", targetTone)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      personality = data;
    }

    // Fetch relevant strategy frameworks
    const { data: frameworks } = await supabase
      .from("brandaro_strategy_frameworks")
      .select("name, structure, best_use_case")
      .order("success_rate", { ascending: false })
      .limit(3);

    // Fetch personality scripts for scenario matching
    let scenarioScripts: any[] = [];
    if (personality) {
      const scenario = objection ? "objection" : "intro";
      const { data } = await supabase
        .from("brandaro_personality_scripts")
        .select("script, scenario")
        .eq("personality_id", personality.id)
        .eq("scenario", scenario)
        .order("performance_score", { ascending: false })
        .limit(2);
      scenarioScripts = data || [];
    }

    // Build the prompt
    const personalityBlock = personality
      ? `PERSONALITY PROFILE:
Name: ${personality.name}
Tone: ${personality.tone}
Cadence: ${personality.cadence}
Persuasion Style: ${personality.persuasion_style}
Objection Handling: ${personality.objection_style}
Closing Style: ${personality.closing_style}
Energy Level: ${personality.energy_level}/10`
      : "Use a confident, professional sales personality.";

    const frameworkBlock = frameworks?.length
      ? `STRATEGY FRAMEWORKS:\n${frameworks.map((f: any) => `- ${f.name}: ${JSON.stringify(f.structure)}`).join("\n")}`
      : "";

    const scriptBlock = scenarioScripts.length
      ? `REFERENCE SCRIPTS (adapt, don't copy):\n${scenarioScripts.map((s: any) => `[${s.scenario}]: ${s.script}`).join("\n")}`
      : "";

    const systemPrompt = `You are an elite AI sales closer operating in real-time during a live call.

${personalityBlock}

${frameworkBlock}

${scriptBlock}

RULES:
- Speak naturally with the personality's tone and energy
- Never sound robotic or scripted
- Always move the conversation toward a close
- Adapt to the lead's behavior in real time
- If objection detected, handle it using the personality's objection style
- If buying signal detected, accelerate toward close
- Keep responses SHORT (1-3 sentences max)
- Match the personality's cadence (${personality?.cadence || "medium"} pace)

Lead heat score: ${lead_heat_score || "unknown"}
Lead type: ${lead_type || "unknown"}
${objection ? `Current objection: ${objection}` : ""}
${context ? `Context: ${JSON.stringify(context)}` : ""}

Respond with a JSON object:
{
  "response_text": "your natural response",
  "tone": "the tone used",
  "strategy_used": "which strategy/framework applied",
  "personality_used": "personality name",
  "detected_objection": "objection type or none",
  "detected_signal": "buying signal or none",
  "mood": "lead mood assessment",
  "should_close_now": boolean,
  "confidence_score": 0-100
}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript_chunk || "Start the conversation." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "personality_response",
            description: "Generate a personality-driven sales response",
            parameters: {
              type: "object",
              properties: {
                response_text: { type: "string" },
                tone: { type: "string" },
                strategy_used: { type: "string" },
                personality_used: { type: "string" },
                detected_objection: { type: "string" },
                detected_signal: { type: "string" },
                mood: { type: "string" },
                should_close_now: { type: "boolean" },
                confidence_score: { type: "number" },
              },
              required: ["response_text", "tone", "strategy_used", "personality_used", "detected_objection", "detected_signal", "mood", "should_close_now", "confidence_score"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "personality_response" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ ok: false, error: "Rate limited, please retry." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ ok: false, error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const result = JSON.parse(toolCall.function.arguments);

    // Update script usage count if we matched scripts
    if (scenarioScripts.length > 0) {
      await supabase.rpc("increment_script_usage", { script_id: scenarioScripts[0].id }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Personality response error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
