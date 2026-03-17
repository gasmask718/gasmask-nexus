import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, input_text, description, personality_name } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "extract-from-transcript") {
      // Extract personality from a sales transcript or script
      const systemPrompt = `You are an expert sales psychology analyst. Analyze the provided sales transcript/script and extract:
1. The speaker's communication tone
2. Their persuasion style
3. How they handle objections
4. Their closing technique
5. Speaking cadence/pace
6. Energy level (1-10)
7. Key phrases they use
8. Strategy frameworks they employ (e.g. value stacking, urgency, future pacing, scarcity, pain amplification)

Then generate 3 scenario scripts (intro, objection, closing) that capture this personality's style.`;

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
            { role: "user", content: `Transcript/Script:\n\n${input_text}\n\n${description ? `Additional context: ${description}` : ""}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_personality",
              description: "Extract structured personality profile from sales transcript",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Suggested personality name" },
                  tone: { type: "string", enum: ["energetic", "calm", "aggressive", "logical", "confident", "empathetic", "authoritative"] },
                  cadence: { type: "string", enum: ["fast", "medium", "slow"] },
                  persuasion_style: { type: "string", enum: ["emotional", "logical", "authority", "curiosity"] },
                  objection_style: { type: "string", enum: ["reframe", "challenge", "validate", "redirect"] },
                  closing_style: { type: "string", enum: ["direct", "assumptive", "soft", "urgency-driven"] },
                  energy_level: { type: "number", minimum: 1, maximum: 10 },
                  key_phrases: { type: "array", items: { type: "string" } },
                  frameworks_detected: { type: "array", items: { type: "string" } },
                  intro_script: { type: "string" },
                  objection_script: { type: "string" },
                  closing_script: { type: "string" },
                  analysis_summary: { type: "string" },
                },
                required: ["name", "tone", "cadence", "persuasion_style", "objection_style", "closing_style", "energy_level", "key_phrases", "frameworks_detected", "intro_script", "objection_script", "closing_script", "analysis_summary"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_personality" } },
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        if (status === 429) return new Response(JSON.stringify({ ok: false, error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ ok: false, error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call in response");
      const extracted = JSON.parse(toolCall.function.arguments);

      // Save personality
      const { data: personality, error: pErr } = await supabase.from("brandaro_personalities").insert({
        name: personality_name || extracted.name,
        description: extracted.analysis_summary,
        tone: extracted.tone,
        cadence: extracted.cadence,
        persuasion_style: extracted.persuasion_style,
        objection_style: extracted.objection_style,
        closing_style: extracted.closing_style,
        energy_level: extracted.energy_level,
        is_active: true,
      }).select().single();

      if (pErr) throw pErr;

      // Save scripts
      const scripts = [
        { personality_id: personality.id, scenario: "intro", script: extracted.intro_script },
        { personality_id: personality.id, scenario: "objection", script: extracted.objection_script },
        { personality_id: personality.id, scenario: "closing", script: extracted.closing_script },
      ];
      await supabase.from("brandaro_personality_scripts").insert(scripts);

      // Save frameworks
      for (const fw of extracted.frameworks_detected) {
        await supabase.from("brandaro_strategy_frameworks").upsert({
          name: fw,
          description: `Extracted from ${personality.name}`,
          structure: { source: "transcript_extraction", personality_id: personality.id },
          best_use_case: `Used by ${personality.name} personality`,
        }, { onConflict: "name" }).catch(() => {});
      }

      return new Response(JSON.stringify({ ok: true, personality, extracted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "generate-from-description") {
      // Generate personality from a text description
      const systemPrompt = `You are an elite sales personality architect. Given a description of a desired sales personality, create a complete structured personality profile with example scripts.`;

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
            { role: "user", content: `Create a sales personality based on this description:\n\n${description}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_personality",
              description: "Create a structured personality from description",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  tone: { type: "string", enum: ["energetic", "calm", "aggressive", "logical", "confident", "empathetic", "authoritative"] },
                  cadence: { type: "string", enum: ["fast", "medium", "slow"] },
                  persuasion_style: { type: "string", enum: ["emotional", "logical", "authority", "curiosity"] },
                  objection_style: { type: "string", enum: ["reframe", "challenge", "validate", "redirect"] },
                  closing_style: { type: "string", enum: ["direct", "assumptive", "soft", "urgency-driven"] },
                  energy_level: { type: "number", minimum: 1, maximum: 10 },
                  intro_script: { type: "string" },
                  objection_script: { type: "string" },
                  closing_script: { type: "string" },
                },
                required: ["name", "description", "tone", "cadence", "persuasion_style", "objection_style", "closing_style", "energy_level", "intro_script", "objection_script", "closing_script"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "create_personality" } },
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        if (status === 429) return new Response(JSON.stringify({ ok: false, error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ ok: false, error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call in response");
      const generated = JSON.parse(toolCall.function.arguments);

      const { data: personality, error: pErr } = await supabase.from("brandaro_personalities").insert({
        name: personality_name || generated.name,
        description: generated.description,
        tone: generated.tone,
        cadence: generated.cadence,
        persuasion_style: generated.persuasion_style,
        objection_style: generated.objection_style,
        closing_style: generated.closing_style,
        energy_level: generated.energy_level,
        is_active: true,
      }).select().single();

      if (pErr) throw pErr;

      const scripts = [
        { personality_id: personality.id, scenario: "intro", script: generated.intro_script },
        { personality_id: personality.id, scenario: "objection", script: generated.objection_script },
        { personality_id: personality.id, scenario: "closing", script: generated.closing_script },
      ];
      await supabase.from("brandaro_personality_scripts").insert(scripts);

      return new Response(JSON.stringify({ ok: true, personality, generated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "seed-starters") {
      // Seed 5 starter personalities
      const starters = [
        {
          name: "The Motivator",
          description: "High-energy emotional closer. Amplifies desire, paints vivid futures, creates urgency through excitement.",
          tone: "energetic", cadence: "fast", persuasion_style: "emotional",
          objection_style: "reframe", closing_style: "urgency-driven", energy_level: 9,
          intro: "Hey! I'm really glad you picked up — I've been looking at your situation and honestly, I think you're sitting on a goldmine. Can I share what I see?",
          objection: "I totally get that — and here's what's wild: the businesses that felt the EXACT same way? They're the ones crushing it right now. What changed? They decided to bet on themselves. What would it mean for you if this actually worked?",
          closing: "Look — I don't want to push you. But I also don't want you to look back in 6 months and say 'I wish I started then.' We've got 2 spots left this week. Want me to lock one in for you right now?",
        },
        {
          name: "The Analyst",
          description: "Logical, ROI-driven closer. Uses numbers, case studies, and clear math to remove doubt.",
          tone: "logical", cadence: "medium", persuasion_style: "logical",
          objection_style: "validate", closing_style: "direct", energy_level: 5,
          intro: "Hi there. I appreciate your time — I know it's valuable, so I'll be direct. I've put together some numbers specific to your market that I think will be interesting. Mind if I walk you through them?",
          objection: "That's a fair concern, and I respect that you're thinking critically about this. Let me show you the math: our average client sees a 3.2x return within 90 days. Even if you performed at half that, you'd still be ahead by month two. Does that math make sense?",
          closing: "Based on everything we've discussed, the ROI case is clear. The question isn't whether this works — the data shows it does. The question is whether you want to start seeing those numbers this quarter or next. Which works better for your timeline?",
        },
        {
          name: "The Commander",
          description: "Aggressive, direct closer. Takes control of conversations, challenges hesitation, drives toward decision.",
          tone: "aggressive", cadence: "fast", persuasion_style: "authority",
          objection_style: "challenge", closing_style: "direct", energy_level: 8,
          intro: "Let me be straight with you — I looked at your current setup and I see three major problems that are costing you money every single day. Want me to tell you what they are?",
          objection: "Here's the thing — 'thinking about it' is what got you to where you are right now. Every day you wait, your competitors get stronger. I'm not trying to be harsh, but I am trying to be honest. Are you ready to fix this or not?",
          closing: "We both know this is the right move. I've laid it all out. The only thing between you and results is a decision. I'm going to send you the link right now — let's get this done.",
        },
        {
          name: "The Consultant",
          description: "Trust-first advisor. Educates before selling, builds deep rapport, uses soft close techniques.",
          tone: "calm", cadence: "slow", persuasion_style: "curiosity",
          objection_style: "validate", closing_style: "soft", energy_level: 4,
          intro: "Hi, thanks for taking my call. Before I talk about anything, I'd love to understand your business better. What's working well for you right now, and where do you feel stuck?",
          objection: "I completely understand that concern — it's actually one of the smartest questions you could ask. Let me address it properly because I want you to feel 100% confident. Here's what we've seen with clients in similar situations...",
          closing: "Based on everything you've shared, it sounds like this could be a really good fit. No pressure at all — but if you're feeling good about it, I'd love to get you started so we can begin working on those goals we discussed. How does that sound?",
        },
        {
          name: "The Hybrid Closer",
          description: "Best-of-all blend. Starts consultative, stacks value logically, closes with controlled urgency. The all-rounder.",
          tone: "confident", cadence: "medium", persuasion_style: "logical",
          objection_style: "reframe", closing_style: "assumptive", energy_level: 7,
          intro: "Hey, appreciate you connecting with me. I've done some homework on your space and I think there's a real opportunity here. Can I share what I found and then you tell me if I'm off base?",
          objection: "Great question — and honestly, if you weren't asking that, I'd be worried. Here's how I think about it: [reframe to value]. Does that shift how you see it?",
          closing: "Alright, so here's what makes sense based on everything: we get you set up this week, you'll start seeing movement within the first 14 days. I'll send over the details now — sound good?",
        },
      ];

      const results = [];
      for (const s of starters) {
        // Check if already exists
        const { data: existing } = await supabase.from("brandaro_personalities")
          .select("id").eq("name", s.name).maybeSingle();
        if (existing) { results.push({ name: s.name, status: "exists" }); continue; }

        const { data: personality, error: pErr } = await supabase.from("brandaro_personalities").insert({
          name: s.name, description: s.description,
          tone: s.tone, cadence: s.cadence,
          persuasion_style: s.persuasion_style, objection_style: s.objection_style,
          closing_style: s.closing_style, energy_level: s.energy_level, is_active: true,
        }).select().single();

        if (pErr) { results.push({ name: s.name, status: "error", error: pErr.message }); continue; }

        await supabase.from("brandaro_personality_scripts").insert([
          { personality_id: personality.id, scenario: "intro", script: s.intro },
          { personality_id: personality.id, scenario: "objection", script: s.objection },
          { personality_id: personality.id, scenario: "closing", script: s.closing },
        ]);

        results.push({ name: s.name, status: "created", id: personality.id });
      }

      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Personality ingestion error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
