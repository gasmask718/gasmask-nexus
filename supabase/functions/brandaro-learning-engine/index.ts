import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...params } = await req.json();

    // ── ACTION: process-learning-event ──
    if (action === "process-learning-event") {
      const { call_session_id, va_user_id, lead_id, outcome, objections, buying_signals, strategies_used, next_action_taken, revenue_generated } = params;

      const SUCCESS_OUTCOMES = ["demo_requested", "closer_ready", "payment_ready", "closed_sale", "interested"];
      const CLOSE_OUTCOMES = ["closed_sale", "payment_ready"];
      const was_success = SUCCESS_OUTCOMES.includes(outcome);
      const was_close = CLOSE_OUTCOMES.includes(outcome);

      // 1. Insert learning event
      const { error: insertErr } = await supabase.from("brandaro_learning_events").insert({
        call_session_id, va_user_id, lead_id, outcome, was_success, was_close,
        revenue_generated: revenue_generated || 0,
        objections: objections || [], buying_signals: buying_signals || [],
        strategies_used: strategies_used || [], next_action_taken,
      });
      if (insertErr) throw insertErr;

      // 2. Update winning patterns for each objection
      const objArr = Array.isArray(objections) ? objections : [];
      for (const obj of objArr) {
        const key = typeof obj === "string" ? obj : obj?.type || obj?.objection_type || "unknown";
        await upsertPattern(supabase, "objection", key, was_success, revenue_generated || 0);
      }

      // 3. Update winning patterns for buying signals
      const sigArr = Array.isArray(buying_signals) ? buying_signals : [];
      for (const sig of sigArr) {
        const key = typeof sig === "string" ? sig : sig?.type || sig?.signal_type || "unknown";
        await upsertPattern(supabase, "signal", key, was_success, revenue_generated || 0);
      }

      // 4. Update winning patterns for strategies
      const stratArr = Array.isArray(strategies_used) ? strategies_used : [];
      for (const strat of stratArr) {
        const key = typeof strat === "string" ? strat : strat?.strategy || "unknown";
        await upsertPattern(supabase, "strategy", key, was_success, revenue_generated || 0);
      }

      // 5. Update response library if objection + strategy pair exists
      for (const obj of objArr) {
        const objKey = typeof obj === "string" ? obj : obj?.type || obj?.objection_type;
        if (!objKey) continue;
        const { data: responses } = await supabase
          .from("brandaro_response_library")
          .select("id, usage_count, success_count")
          .eq("objection_type", objKey)
          .eq("is_active", true);

        if (responses && responses.length > 0) {
          for (const r of responses) {
            const newUsage = (r.usage_count || 0) + 1;
            const newSuccess = was_success ? (r.success_count || 0) + 1 : (r.success_count || 0);
            const newRate = newUsage > 0 ? Math.round((newSuccess / newUsage) * 100) : 0;
            await supabase.from("brandaro_response_library").update({
              usage_count: newUsage, success_count: newSuccess, success_rate: newRate,
              updated_at: new Date().toISOString(),
            }).eq("id", r.id);
          }
        }
      }

      // 6. Update VA skill profile
      await updateVASkillProfile(supabase, va_user_id);

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: optimize-responses ──
    if (action === "optimize-responses") {
      // Deactivate low-performing responses (sample >= 10, rate < 20%)
      await supabase.from("brandaro_response_library")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .gte("usage_count", 10)
        .lt("success_rate", 20);

      // Generate new responses using AI for top objections without high-performing responses
      const { data: patterns } = await supabase
        .from("brandaro_winning_patterns")
        .select("*")
        .eq("pattern_type", "objection")
        .gte("sample_size", 5)
        .order("sample_size", { ascending: false })
        .limit(10);

      if (patterns) {
        for (const p of patterns) {
          const { data: existing } = await supabase
            .from("brandaro_response_library")
            .select("id")
            .eq("objection_type", p.pattern_key)
            .eq("is_active", true);

          if (!existing || existing.length < 2) {
            // Seed a response based on pattern data
            const SEED_RESPONSES: Record<string, { text: string; strategy: string }> = {
              too_expensive: { text: "I understand. Most people say that before they see how fast this pays for itself. Would it help if I showed you the ROI breakdown?", strategy: "ROI framing" },
              not_interested: { text: "Totally fair — usually that means either timing isn't right or you already have something working. Which one is it for you?", strategy: "pattern interrupt" },
              too_busy: { text: "Understood. What's a better time today or tomorrow for a 3-minute follow-up?", strategy: "lower friction" },
              already_have_solution: { text: "That's actually helpful. Most businesses we help already had something — the issue was it wasn't converting enough.", strategy: "differentiation" },
              send_me_info: { text: "Absolutely. What's the best email, and when should I follow up after you take a look?", strategy: "control next step" },
              need_to_ask_partner: { text: "Makes sense. Usually the easiest move is to set a quick time when both of you can review it together.", strategy: "multi-stakeholder" },
              no_budget: { text: "I hear you. What most clients find is that this actually replaces spend they're already wasting. Can I show you how?", strategy: "reframe spend" },
              bad_timing: { text: "When would be the right time? I'll make sure to circle back then so you don't miss out.", strategy: "future lock" },
              skeptical_results: { text: "Fair point. Let me show you a real case study from a business just like yours — would that help?", strategy: "social proof" },
              not_decision_maker: { text: "Got it. Who would be the best person to loop in? I can send them a quick summary to review.", strategy: "chain referral" },
            };

            const seed = SEED_RESPONSES[p.pattern_key];
            if (seed) {
              await supabase.from("brandaro_response_library").insert({
                objection_type: p.pattern_key,
                response_text: seed.text,
                strategy: seed.strategy,
                is_active: true,
              });
            }
          }
        }
      }

      return new Response(JSON.stringify({ ok: true, optimized: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: get-intelligence ──
    if (action === "get-intelligence") {
      const [patternsRes, responsesRes, skillsRes] = await Promise.all([
        supabase.from("brandaro_winning_patterns").select("*").gte("sample_size", 3).order("success_rate", { ascending: false }).limit(20),
        supabase.from("brandaro_response_library").select("*").eq("is_active", true).order("success_rate", { ascending: false }).limit(20),
        supabase.from("brandaro_va_skill_profiles").select("*").order("conversion_rate", { ascending: false }),
      ]);

      return new Response(JSON.stringify({
        patterns: patternsRes.data || [],
        responses: responsesRes.data || [],
        skills: skillsRes.data || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("learning-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function upsertPattern(supabase: any, patternType: string, patternKey: string, wasSuccess: boolean, revenue: number) {
  const { data: existing } = await supabase
    .from("brandaro_winning_patterns")
    .select("id, sample_size, success_rate, avg_revenue")
    .eq("pattern_type", patternType)
    .eq("pattern_key", patternKey)
    .maybeSingle();

  if (existing) {
    const newSample = (existing.sample_size || 0) + 1;
    const oldSuccesses = Math.round(((existing.success_rate || 0) / 100) * (existing.sample_size || 0));
    const newSuccesses = wasSuccess ? oldSuccesses + 1 : oldSuccesses;
    const newRate = Math.round((newSuccesses / newSample) * 100);
    const oldRevTotal = (existing.avg_revenue || 0) * (existing.sample_size || 0);
    const newAvgRev = Math.round((oldRevTotal + revenue) / newSample);

    await supabase.from("brandaro_winning_patterns").update({
      sample_size: newSample, success_rate: newRate, avg_revenue: newAvgRev,
      last_updated: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await supabase.from("brandaro_winning_patterns").insert({
      pattern_type: patternType, pattern_key: patternKey,
      sample_size: 1, success_rate: wasSuccess ? 100 : 0, avg_revenue: revenue,
    });
  }
}

async function updateVASkillProfile(supabase: any, vaUserId: string) {
  // Get recent learning events for this VA
  const { data: events } = await supabase
    .from("brandaro_learning_events")
    .select("*")
    .eq("va_user_id", vaUserId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!events || events.length < 3) return;

  const total = events.length;
  const successes = events.filter((e: any) => e.was_success).length;
  const closes = events.filter((e: any) => e.was_close).length;

  // Objection handling: % of calls with objections that still succeeded
  const withObjections = events.filter((e: any) => Array.isArray(e.objections) && e.objections.length > 0);
  const objSuccesses = withObjections.filter((e: any) => e.was_success).length;
  const objScore = withObjections.length > 0 ? Math.round((objSuccesses / withObjections.length) * 100) : 50;

  // Closing score
  const closingScore = total > 0 ? Math.round((closes / total) * 100) : 0;

  // Follow-up score: % with next_action_taken filled
  const withFollowup = events.filter((e: any) => e.next_action_taken && e.next_action_taken !== "none").length;
  const followupScore = total > 0 ? Math.round((withFollowup / total) * 100) : 0;

  const conversionRate = total > 0 ? Math.round((successes / total) * 100) : 0;

  const scores = { objection_handling: objScore, closing: closingScore, followup: followupScore };
  const strongest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const weakest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0];

  const { data: existing } = await supabase
    .from("brandaro_va_skill_profiles")
    .select("id")
    .eq("va_user_id", vaUserId)
    .maybeSingle();

  if (existing) {
    await supabase.from("brandaro_va_skill_profiles").update({
      objection_handling_score: objScore, closing_score: closingScore,
      followup_score: followupScore, conversion_rate: conversionRate,
      strongest_area: strongest, weakest_area: weakest,
      last_updated: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await supabase.from("brandaro_va_skill_profiles").insert({
      va_user_id: vaUserId, objection_handling_score: objScore,
      closing_score: closingScore, followup_score: followupScore,
      conversion_rate: conversionRate, strongest_area: strongest,
      weakest_area: weakest,
    });
  }
}
