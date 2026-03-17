import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      lead_id,
      lead_heat_score,
      lead_type,
      transcript_chunk,
      detected_objection,
      detected_signal,
      current_personality_id,
      emotion_state,
    } = await req.json();

    // Fetch active personalities with performance data
    const { data: personalities } = await supabase
      .from("brandaro_personalities")
      .select("id, name, nickname, archetype, tone, cadence, persuasion_style, objection_style, closing_style, energy_level, inspiration_tags")
      .eq("is_active", true);

    if (!personalities || personalities.length === 0) {
      return new Response(JSON.stringify({ error: "No active personalities available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch recent assignment performance
    const { data: recentAssignments } = await supabase
      .from("brandaro_personality_assignments")
      .select("personality_id, assigned_reason")
      .order("created_at", { ascending: false })
      .limit(100);

    // Build performance summary per personality
    const perfMap: Record<string, number> = {};
    (recentAssignments || []).forEach((a: any) => {
      perfMap[a.personality_id] = (perfMap[a.personality_id] || 0) + 1;
    });

    const personalityList = personalities.map((p: any) => ({
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      archetype: p.archetype,
      tone: p.tone,
      cadence: p.cadence,
      persuasion_style: p.persuasion_style,
      objection_style: p.objection_style,
      closing_style: p.closing_style,
      energy_level: p.energy_level,
      usage_count: perfMap[p.id] || 0,
    }));

    const systemPrompt = `You are the Personality Selector AI for Dynasty OS.

You select the BEST sales personality for a given situation based on lead data and live conversation signals.

AVAILABLE PERSONALITIES:
${JSON.stringify(personalityList, null, 2)}

SELECTION RULES:
- Cold lead / low heat → Trust Builder / Consultant archetype
- Skeptical / price objection → Logical Persuader / Analyst archetype
- High intent / hot lead → Authority / Commander archetype
- General / warm → Social Persuader / Connector archetype
- High energy expected → Emotional Driver / Energizer archetype
- If emotion_state is "frustrated" or "defensive" → prefer calm, trust-building personality
- If emotion_state is "excited" or "interested" → match energy, push toward close
- If emotion_state is "confused" → prefer educational, consultative personality
- If current_personality_id is set and working well, DON'T switch unnecessarily
- Max 2-3 switches per call — avoid over-switching
- Always justify with data

CONFIDENCE:
- If confidence < 60, recommend a hybrid blend of two personalities`;

    const userPrompt = `LEAD DATA:
- Lead ID: ${lead_id || "unknown"}
- Heat Score: ${lead_heat_score ?? "unknown"}
- Lead Type: ${lead_type || "unknown"}
- Current Personality: ${current_personality_id || "none"}
- Detected Emotion: ${emotion_state || "unknown"}
- Detected Objection: ${detected_objection || "none"}
- Detected Signal: ${detected_signal || "none"}
${transcript_chunk ? `\nLATEST TRANSCRIPT:\n"${transcript_chunk}"` : ""}

Select the optimal personality. If current personality is working, you can keep it.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "select_personality",
            description: "Select the best personality for the current sales situation",
            parameters: {
              type: "object",
              properties: {
                selected_personality_id: { type: "string", description: "UUID of the selected personality" },
                nickname: { type: "string", description: "Nickname of the selected personality" },
                archetype: { type: "string", description: "Archetype of the selected personality" },
                reason: { type: "string", description: "Why this personality was selected (1-2 sentences)" },
                confidence_score: { type: "number", description: "Selection confidence 0-100" },
                switch_recommended: { type: "boolean", description: "Whether to switch from current personality" },
                blend_with: { type: "string", description: "If confidence < 60, UUID of secondary personality to blend with, otherwise null" },
                blend_ratio: { type: "number", description: "Primary personality weight 0-100 (e.g. 70 means 70% primary, 30% secondary)" },
              },
              required: ["selected_personality_id", "nickname", "archetype", "reason", "confidence_score", "switch_recommended"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "select_personality" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI selection failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No structured response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Log assignment if switching
    if (result.switch_recommended && lead_id) {
      await supabase.from("brandaro_personality_assignments").insert({
        lead_id,
        personality_id: result.selected_personality_id,
        assigned_reason: result.reason,
      });
    }

    return new Response(JSON.stringify({ ok: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("select-personality error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
