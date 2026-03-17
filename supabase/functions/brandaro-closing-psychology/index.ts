import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Persuasion Frameworks ───
const FRAMEWORKS = {
  pas: {
    name: "Problem → Agitate → Solution",
    stages: ["identify_problem", "intensify_pain", "present_solution"],
    bestFor: ["skeptical", "resistant"],
  },
  value_stack: {
    name: "Value Stacking",
    stages: ["list_benefits", "quantify_value", "compare_cost"],
    bestFor: ["curious", "interested"],
  },
  future_pace: {
    name: "Future Pacing",
    stages: ["paint_future", "contrast_present", "bridge_gap"],
    bestFor: ["interested", "excited"],
  },
  loss_aversion: {
    name: "Loss Aversion",
    stages: ["show_risk", "quantify_loss", "present_safety"],
    bestFor: ["skeptical", "curious"],
  },
  social_proof: {
    name: "Social Proof",
    stages: ["share_results", "name_similar_clients", "show_momentum"],
    bestFor: ["skeptical", "resistant"],
  },
  authority: {
    name: "Authority Positioning",
    stages: ["establish_expertise", "share_credentials", "demonstrate_knowledge"],
    bestFor: ["resistant", "skeptical"],
  },
};

// ─── Urgency Tactics ───
const URGENCY_TACTICS = {
  limited_availability: [
    "We only have {n} spots left this month.",
    "This particular offer closes at end of day.",
  ],
  time_sensitive: [
    "The pricing changes after this week.",
    "This promotional rate expires in 48 hours.",
  ],
  opportunity_cost: [
    "Every day without this is costing you approximately ${cost}/day.",
    "Your competitors are already using this — every week you wait is ground lost.",
  ],
  delayed_loss: [
    "The longer you wait, the harder it gets to catch up.",
    "Most people who say 'later' end up paying more when they come back.",
  ],
};

// ─── Closing Lines by Style ───
const CLOSING_LINES = {
  aggressive: [
    "Let's lock this in right now — I'll send the link.",
    "There's no reason to wait. Let's get you started today.",
    "I'm going to send you the payment link — you'll be set up in 2 minutes.",
  ],
  consultative: [
    "Based on everything we've discussed, this seems like a perfect fit. Shall we get started?",
    "I think the best next step is to secure your spot. Want me to set that up?",
    "Let me walk you through the quick setup — it takes less than 3 minutes.",
  ],
  empathetic: [
    "I want to make sure you feel completely comfortable. What would help you make this decision?",
    "I can see this matters to you. Let's make it happen together.",
    "You deserve this solution — let's get it set up for you.",
  ],
  logical: [
    "The numbers speak for themselves — the ROI is clear. Ready to proceed?",
    "Given the data, this is the optimal decision. Let's finalize.",
    "From a purely analytical standpoint, waiting costs more than acting. Shall we move forward?",
  ],
};

// ─── Decision Control Phrases ───
const DECISION_CONTROL = {
  never_passive: [
    "Let's get this set up now — I'll walk you through it.",
    "Here's what I recommend we do next.",
    "The best move right now is to lock this in.",
  ],
  assumptive_close: [
    "Great — I'll send the link now. You prefer email or text?",
    "Perfect. Let me set up your account. What email should I use?",
    "Awesome — I'll get this started for you right away.",
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, lead_id, emotional_state, objection, personality_style, closing_stage, context } = await req.json();

    // ─── ACTION: select_framework ───
    if (action === "select_framework") {
      const emotion = emotional_state || "curious";
      const ranked = Object.entries(FRAMEWORKS)
        .map(([key, fw]) => ({
          key,
          ...fw,
          score: fw.bestFor.includes(emotion) ? 2 : 1,
        }))
        .sort((a, b) => b.score - a.score);

      // Check framework stats for performance data
      const { data: stats } = await sb
        .from("brandaro_framework_stats")
        .select("framework_name, close_rate, times_used")
        .order("close_rate", { ascending: false });

      const statsMap: Record<string, any> = {};
      for (const s of stats || []) statsMap[s.framework_name] = s;

      const recommended = ranked.map((fw) => ({
        ...fw,
        historical_close_rate: statsMap[fw.key]?.close_rate || null,
        historical_uses: statsMap[fw.key]?.times_used || 0,
      }));

      return new Response(JSON.stringify({
        recommended_framework: recommended[0].key,
        all_frameworks: recommended,
        emotional_state: emotion,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ACTION: handle_objection ───
    if (action === "handle_objection") {
      if (!objection) throw new Error("objection text required");

      // Classify objection
      const categories = ["price", "timing", "interest", "authority", "need"];
      const keywords: Record<string, string[]> = {
        price: ["expensive", "cost", "price", "afford", "budget", "money", "cheap"],
        timing: ["later", "think", "time", "busy", "not now", "wait"],
        interest: ["not interested", "don't need", "no thanks"],
        authority: ["partner", "boss", "wife", "husband", "team", "decide"],
        need: ["send info", "email", "information", "details", "brochure"],
      };

      let detectedCategory = "interest";
      const lower = objection.toLowerCase();
      for (const [cat, kws] of Object.entries(keywords)) {
        if (kws.some((kw) => lower.includes(kw))) {
          detectedCategory = cat;
          break;
        }
      }

      // Get best response from library
      const style = personality_style || "consultative";
      const { data: responses } = await sb
        .from("brandaro_objection_library")
        .select("*")
        .eq("objection_category", detectedCategory)
        .eq("is_active", true)
        .order("win_rate", { ascending: false });

      // Prefer matching style, fallback to highest win rate
      const matched = responses?.find((r: any) => r.personality_style === style) || responses?.[0];

      // Log interaction
      if (lead_id && matched) {
        await sb.from("brandaro_closing_interactions").insert({
          lead_id,
          framework_used: "objection_handling",
          objection_detected: objection,
          objection_response_strategy: matched.response_strategy,
          emotional_state: emotional_state || "resistant",
          closing_stage: "objection_handling",
          personality_id: personality_style,
        });

        // Increment usage counter
        await sb.rpc("increment_field", { table_name: "brandaro_objection_library", row_id: matched.id, field_name: "times_used", increment_by: 1 }).catch(() => {});
      }

      return new Response(JSON.stringify({
        objection_category: detectedCategory,
        response: matched?.response_template || "I hear you — let me address that directly.",
        strategy: matched?.response_strategy || "acknowledge_reframe",
        style: matched?.personality_style || style,
        win_rate: matched?.win_rate || 0,
        follow_up: DECISION_CONTROL.never_passive[Math.floor(Math.random() * DECISION_CONTROL.never_passive.length)],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ACTION: generate_urgency ───
    if (action === "generate_urgency") {
      const tactics = Object.entries(URGENCY_TACTICS).map(([key, lines]) => ({
        tactic: key,
        line: lines[Math.floor(Math.random() * lines.length)],
      }));

      // Select based on emotional state
      let bestTactic = "opportunity_cost";
      if (emotional_state === "interested" || emotional_state === "excited") bestTactic = "limited_availability";
      if (emotional_state === "skeptical") bestTactic = "delayed_loss";
      if (emotional_state === "curious") bestTactic = "time_sensitive";

      const selected = tactics.find((t) => t.tactic === bestTactic) || tactics[0];

      return new Response(JSON.stringify({
        selected_tactic: selected,
        all_tactics: tactics,
        closing_line: CLOSING_LINES[personality_style as keyof typeof CLOSING_LINES]?.[
          Math.floor(Math.random() * 3)
        ] || CLOSING_LINES.consultative[0],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ACTION: closing_sequence ───
    if (action === "closing_sequence") {
      const stage = closing_stage || "discovery";
      const stages = ["discovery", "positioning", "value_expansion", "objection_handling", "commitment_push"];
      const currentIndex = stages.indexOf(stage);
      const nextStage = stages[Math.min(currentIndex + 1, stages.length - 1)];

      const style = (personality_style || "consultative") as keyof typeof CLOSING_LINES;
      const closingLine = CLOSING_LINES[style]?.[Math.floor(Math.random() * 3)] || CLOSING_LINES.consultative[0];
      const assumptive = DECISION_CONTROL.assumptive_close[Math.floor(Math.random() * DECISION_CONTROL.assumptive_close.length)];

      // Log progression
      if (lead_id) {
        await sb.from("brandaro_closing_interactions").insert({
          lead_id,
          framework_used: context?.framework || "closing_sequence",
          emotional_state: emotional_state || "interested",
          closing_stage: stage,
          buying_signal_detected: currentIndex >= 3,
          personality_id: personality_style,
          closing_line_used: stage === "commitment_push" ? closingLine : null,
        });
      }

      return new Response(JSON.stringify({
        current_stage: stage,
        next_stage: nextStage,
        is_final_push: currentIndex >= 3,
        closing_line: closingLine,
        assumptive_close: currentIndex >= 3 ? assumptive : null,
        guidance: stage === "discovery" ? "Ask about their current situation and pain points"
          : stage === "positioning" ? "Align your solution to their specific needs"
          : stage === "value_expansion" ? "Stack benefits and quantify the ROI"
          : stage === "objection_handling" ? "Address concerns with reframes"
          : "Push for commitment — use assumptive close",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ACTION: log_outcome ───
    if (action === "log_outcome") {
      const { outcome, revenue, framework_used } = context || {};

      if (lead_id) {
        await sb.from("brandaro_closing_interactions").insert({
          lead_id,
          framework_used: framework_used || "unknown",
          emotional_state: emotional_state || "unknown",
          closing_stage: "commitment_push",
          outcome,
          revenue_attributed: revenue || 0,
          buying_signal_detected: outcome === "closed",
          personality_id: personality_style,
        });

        // Update framework stats
        if (framework_used) {
          const { data: existing } = await sb
            .from("brandaro_framework_stats")
            .select("*")
            .eq("framework_name", framework_used)
            .eq("personality_id", personality_style || "default")
            .maybeSingle();

          if (existing) {
            await sb.from("brandaro_framework_stats").update({
              times_used: (existing.times_used || 0) + 1,
              times_closed: (existing.times_closed || 0) + (outcome === "closed" ? 1 : 0),
              total_revenue: (existing.total_revenue || 0) + (revenue || 0),
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id);
          } else {
            await sb.from("brandaro_framework_stats").insert({
              framework_name: framework_used,
              personality_id: personality_style || "default",
              times_used: 1,
              times_closed: outcome === "closed" ? 1 : 0,
              total_revenue: revenue || 0,
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, logged: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: get_psychology_stats ───
    if (action === "get_psychology_stats") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [interactions, frameworks, objections] = await Promise.all([
        sb.from("brandaro_closing_interactions").select("*").gte("created_at", since),
        sb.from("brandaro_framework_stats").select("*").order("close_rate", { ascending: false }),
        sb.from("brandaro_objection_library").select("*").eq("is_active", true).order("win_rate", { ascending: false }),
      ]);

      const i = interactions.data || [];
      const totalInteractions = i.length;
      const closed = i.filter((x: any) => x.outcome === "closed").length;
      const objectionHandled = i.filter((x: any) => x.outcome === "objection_handled").length;
      const objectionFailed = i.filter((x: any) => x.outcome === "objection_failed").length;
      const totalRevenue = i.reduce((s: number, x: any) => s + (x.revenue_attributed || 0), 0);
      const buyingSignals = i.filter((x: any) => x.buying_signal_detected).length;

      return new Response(JSON.stringify({
        today: {
          interactions: totalInteractions,
          closed,
          close_rate: totalInteractions > 0 ? ((closed / totalInteractions) * 100).toFixed(1) : "0",
          objection_win_rate: (objectionHandled + objectionFailed) > 0
            ? ((objectionHandled / (objectionHandled + objectionFailed)) * 100).toFixed(1) : "0",
          revenue: totalRevenue,
          buying_signals: buyingSignals,
        },
        top_frameworks: (frameworks.data || []).slice(0, 5),
        top_objection_responses: (objections.data || []).slice(0, 5),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
