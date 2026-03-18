import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...params } = await req.json();

    // ── ACTION: Evaluate & rank all personalities ──
    if (action === "evaluate-rankings") {
      const { data: perfs } = await sb
        .from("brandaro_personality_performance")
        .select("personality_id, total_calls, conversions, revenue_generated, objection_wins, objection_total, avg_time_to_close_mins, engagement_score")
        .gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));

      // Aggregate by personality
      const agg: Record<string, any> = {};
      for (const p of perfs || []) {
        const id = p.personality_id;
        if (!agg[id]) agg[id] = { calls: 0, conv: 0, rev: 0, objW: 0, objT: 0, time: 0, eng: 0, days: 0 };
        agg[id].calls += p.total_calls || 0;
        agg[id].conv += p.conversions || 0;
        agg[id].rev += Number(p.revenue_generated) || 0;
        agg[id].objW += p.objection_wins || 0;
        agg[id].objT += p.objection_total || 0;
        agg[id].time += Number(p.avg_time_to_close_mins) || 0;
        agg[id].eng += Number(p.engagement_score) || 0;
        agg[id].days += 1;
      }

      const rankings: any[] = [];
      for (const [pid, a] of Object.entries(agg) as any) {
        const convRate = a.calls > 0 ? (a.conv / a.calls) * 100 : 0;
        const revPerLead = a.calls > 0 ? a.rev / a.calls : 0;
        const objWinRate = a.objT > 0 ? (a.objW / a.objT) * 100 : 0;
        const speedScore = a.days > 0 ? Math.max(0, 100 - (a.time / a.days)) : 50;
        const composite = (convRate * 0.35) + (revPerLead * 0.25) + (objWinRate * 0.25) + (speedScore * 0.15);

        let tier = "testing";
        if (a.calls >= 50 && composite >= 60) tier = "scaling";
        else if (a.calls >= 20 && composite >= 40) tier = "optimizing";
        else if (a.calls >= 50 && composite < 20) tier = "retired";

        rankings.push({
          personality_id: pid,
          conversion_rate: Math.round(convRate * 100) / 100,
          revenue_per_lead: Math.round(revPerLead * 100) / 100,
          objection_win_rate: Math.round(objWinRate * 100) / 100,
          speed_score: Math.round(speedScore * 100) / 100,
          composite_score: Math.round(composite * 100) / 100,
          tier,
          last_evaluated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Sort and assign rank
      rankings.sort((a, b) => b.composite_score - a.composite_score);
      for (let i = 0; i < rankings.length; i++) rankings[i].rank_position = i + 1;

      // Upsert rankings
      for (const r of rankings) {
        await sb.from("brandaro_personality_rankings").upsert(r, { onConflict: "personality_id" });
      }

      // Auto-disable retired
      const retired = rankings.filter(r => r.tier === "retired").map(r => r.personality_id);
      if (retired.length) {
        await sb.from("brandaro_personalities").update({ is_active: false }).in("id", retired);
      }

      return new Response(JSON.stringify({ ok: true, ranked: rankings.length, retired: retired.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: Evolve top personality (enhance traits) ──
    if (action === "evolve-top-performers") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      const { data: topRanked } = await sb
        .from("brandaro_personality_rankings")
        .select("personality_id, composite_score, conversion_rate, objection_win_rate, tier")
        .in("tier", ["scaling", "optimizing"])
        .order("composite_score", { ascending: false })
        .limit(3);

      if (!topRanked?.length) {
        return new Response(JSON.stringify({ ok: true, evolved: 0, reason: "no eligible personalities" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const evolved: string[] = [];

      for (const ranked of topRanked) {
        const { data: personality } = await sb
          .from("brandaro_personalities")
          .select("*")
          .eq("id", ranked.personality_id)
          .single();

        if (!personality) continue;

        // Use AI to suggest evolution
        let suggestions: any = {};
        if (LOVABLE_API_KEY) {
          try {
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: "You are a sales personality optimizer. Given a personality profile and its performance metrics, suggest specific improvements. Return JSON with fields: enhanced_tone, enhanced_cadence, enhanced_persuasion_style, enhanced_objection_style, enhanced_closing_style, enhanced_energy_level (1-10), reasoning." },
                  { role: "user", content: JSON.stringify({
                    current: { tone: personality.tone, cadence: personality.cadence, persuasion_style: personality.persuasion_style, objection_style: personality.objection_style, closing_style: personality.closing_style, energy_level: personality.energy_level },
                    metrics: ranked,
                  })},
                ],
                tools: [{
                  type: "function",
                  function: {
                    name: "suggest_evolution",
                    description: "Suggest evolved personality traits",
                    parameters: {
                      type: "object",
                      properties: {
                        enhanced_tone: { type: "string" },
                        enhanced_cadence: { type: "string" },
                        enhanced_persuasion_style: { type: "string" },
                        enhanced_objection_style: { type: "string" },
                        enhanced_closing_style: { type: "string" },
                        enhanced_energy_level: { type: "number" },
                        reasoning: { type: "string" },
                      },
                      required: ["enhanced_tone", "enhanced_persuasion_style", "reasoning"],
                    },
                  },
                }],
                tool_choice: { type: "function", function: { name: "suggest_evolution" } },
              }),
            });
            const aiData = await aiResp.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) suggestions = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            console.error("AI evolution failed, using heuristic:", e);
          }
        }

        // Apply evolution (AI-suggested or heuristic)
        const updates: any = {};
        if (suggestions.enhanced_tone) updates.tone = suggestions.enhanced_tone;
        if (suggestions.enhanced_cadence) updates.cadence = suggestions.enhanced_cadence;
        if (suggestions.enhanced_persuasion_style) updates.persuasion_style = suggestions.enhanced_persuasion_style;
        if (suggestions.enhanced_objection_style) updates.objection_style = suggestions.enhanced_objection_style;
        if (suggestions.enhanced_closing_style) updates.closing_style = suggestions.enhanced_closing_style;
        if (suggestions.enhanced_energy_level) updates.energy_level = suggestions.enhanced_energy_level;

        if (Object.keys(updates).length > 0) {
          await sb.from("brandaro_personalities").update(updates).eq("id", personality.id);

          // Log evolution
          await sb.from("brandaro_personality_evolution").insert({
            personality_id: personality.id,
            parent_personality_id: personality.id,
            evolution_type: "enhancement",
            traits_inherited: { tone: personality.tone, cadence: personality.cadence, persuasion_style: personality.persuasion_style },
            traits_modified: updates,
            reason: suggestions.reasoning || "AI-driven performance optimization",
            performance_before: ranked,
          });

          evolved.push(personality.name);
        }
      }

      return new Response(JSON.stringify({ ok: true, evolved: evolved.length, personalities: evolved }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: Auto-generate new personality (crossover of top 2) ──
    if (action === "auto-generate") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      const { data: top2 } = await sb
        .from("brandaro_personality_rankings")
        .select("personality_id")
        .order("composite_score", { ascending: false })
        .limit(2);

      if (!top2 || top2.length < 2) {
        return new Response(JSON.stringify({ ok: true, generated: false, reason: "need at least 2 ranked personalities" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: parents } = await sb
        .from("brandaro_personalities")
        .select("*")
        .in("id", top2.map(t => t.personality_id));

      if (!parents || parents.length < 2) {
        return new Response(JSON.stringify({ ok: true, generated: false, reason: "parents not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let newPersonality: any = null;

      if (LOVABLE_API_KEY) {
        try {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You breed AI sales personalities. Given two parent personalities, create a new offspring that combines their best traits with a unique twist. Return JSON." },
                { role: "user", content: JSON.stringify({ parent_a: parents[0], parent_b: parents[1] }) },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "create_offspring",
                  description: "Create a new personality from two parents",
                  parameters: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      tone: { type: "string" },
                      cadence: { type: "string" },
                      persuasion_style: { type: "string" },
                      objection_style: { type: "string" },
                      closing_style: { type: "string" },
                      energy_level: { type: "number" },
                    },
                    required: ["name", "tone", "cadence", "persuasion_style", "objection_style", "closing_style", "energy_level"],
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "create_offspring" } },
            }),
          });
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) newPersonality = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error("AI generation failed:", e);
        }
      }

      // Fallback: heuristic crossover
      if (!newPersonality) {
        const gen = Math.floor(Math.random() * 1000);
        newPersonality = {
          name: `Gen-${gen} Hybrid`,
          description: `Auto-generated crossover of ${parents[0].name} and ${parents[1].name}`,
          tone: Math.random() > 0.5 ? parents[0].tone : parents[1].tone,
          cadence: Math.random() > 0.5 ? parents[0].cadence : parents[1].cadence,
          persuasion_style: Math.random() > 0.5 ? parents[0].persuasion_style : parents[1].persuasion_style,
          objection_style: Math.random() > 0.5 ? parents[0].objection_style : parents[1].objection_style,
          closing_style: Math.random() > 0.5 ? parents[0].closing_style : parents[1].closing_style,
          energy_level: Math.round((parents[0].energy_level + parents[1].energy_level) / 2),
        };
      }

      const { data: created } = await sb
        .from("brandaro_personalities")
        .insert({ ...newPersonality, is_active: true })
        .select()
        .single();

      if (created) {
        await sb.from("brandaro_personality_evolution").insert({
          personality_id: created.id,
          parent_personality_id: parents[0].id,
          evolution_type: "crossover",
          traits_inherited: { from_a: parents[0].name, from_b: parents[1].name },
          traits_modified: newPersonality,
          reason: "Auto-generated crossover of top performers",
        });

        // Initialize ranking entry in testing tier
        await sb.from("brandaro_personality_rankings").insert({
          personality_id: created.id,
          tier: "testing",
          rank_position: 999,
        });
      }

      return new Response(JSON.stringify({ ok: true, generated: true, personality: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: Get evolution dashboard data ──
    if (action === "get-dashboard") {
      const [rankings, evolutions, tests] = await Promise.all([
        sb.from("brandaro_personality_rankings")
          .select("*, brandaro_personalities(name, tone, is_active)")
          .order("rank_position", { ascending: true })
          .limit(20),
        sb.from("brandaro_personality_evolution")
          .select("*, brandaro_personalities!brandaro_personality_evolution_personality_id_fkey(name)")
          .order("created_at", { ascending: false })
          .limit(10),
        sb.from("brandaro_personality_ab_tests")
          .select("*, personality_a:brandaro_personalities!brandaro_personality_ab_tests_personality_a_id_fkey(name), personality_b:brandaro_personalities!brandaro_personality_ab_tests_personality_b_id_fkey(name)")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      return new Response(JSON.stringify({
        ok: true,
        rankings: rankings.data || [],
        evolutions: evolutions.data || [],
        tests: tests.data || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: Start A/B test ──
    if (action === "start-ab-test") {
      const { personality_a_id, personality_b_id, name } = params;
      const { data } = await sb.from("brandaro_personality_ab_tests").insert({
        name: name || "Auto A/B Test",
        personality_a_id,
        personality_b_id,
      }).select().single();

      return new Response(JSON.stringify({ ok: true, test: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: Full evolution cycle (evaluate → evolve → generate) ──
    if (action === "full-cycle") {
      const baseUrl = Deno.env.get("SUPABASE_URL")! + "/functions/v1/brandaro-personality-evolution";
      const headers = { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };

      const evalResp = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({ action: "evaluate-rankings" }) });
      const evalResult = await evalResp.json();

      const evolveResp = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({ action: "evolve-top-performers" }) });
      const evolveResult = await evolveResp.json();

      const genResp = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({ action: "auto-generate" }) });
      const genResult = await genResp.json();

      return new Response(JSON.stringify({
        ok: true,
        evaluation: evalResult,
        evolution: evolveResult,
        generation: genResult,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("personality-evolution error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
