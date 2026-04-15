import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { call_id, business_unit, transcript, duration_seconds, contact_name, company_name } =
      await req.json();

    if (!call_id || !transcript) {
      return new Response(
        JSON.stringify({ error: "call_id and transcript are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing call ${call_id} (${duration_seconds}s, ${business_unit})`);

    const prompt = `You are an elite sales call analyst for Dynasty OS. Analyze this ${business_unit} sales call transcript and return a JSON object with your analysis.

Contact: ${contact_name || "Unknown"} | Company: ${company_name || "Unknown"} | Duration: ${duration_seconds}s

TRANSCRIPT:
${transcript}

Return ONLY valid JSON with this exact structure:
{
  "overall_score": <0-10>,
  "rapport_score": <0-10>,
  "objection_handling_score": <0-10>,
  "qualification_score": <0-10>,
  "closing_score": <0-10>,
  "energy_score": <0-10>,
  "what_went_well": ["point1", "point2"],
  "what_to_improve": ["point1", "point2"],
  "missed_opportunities": ["point1"],
  "best_moment": "description of strongest moment",
  "worst_moment": "description of weakest moment",
  "specific_coaching": "1-2 sentence coaching tip",
  "script_adherence_percentage": <0-100>,
  "talk_to_listen_ratio": <0-100 percentage of time rep was talking>,
  "objections_raised": ["objection1", "objection2"],
  "objection_handling_grade": "<A|B|C|D|F>",
  "objection_handling_notes": "how objections were handled",
  "recommended_followup": "specific next step",
  "callback_timing": "<immediate|3_days|1_week|1_month|never>",
  "suggested_talking_points": ["point1", "point2"],
  "customer_sentiment": "<positive|neutral|negative|hostile>",
  "rep_sentiment": "<confident|uncertain|discouraged>",
  "key_moments": [{"timestamp": <seconds>, "label": "description", "type": "<positive|negative|neutral>"}]
}`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error(`Claude API error [${claudeResponse.status}]:`, errText);
      throw new Error(`Claude API failed: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const rawContent = claudeData.content?.[0]?.text || "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response:", rawContent.slice(0, 200));
      throw new Error("Failed to parse Claude analysis response");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Calculate approximate analysis cost (Claude input + output tokens)
    const inputTokens = claudeData.usage?.input_tokens || 0;
    const outputTokens = claudeData.usage?.output_tokens || 0;
    // Sonnet pricing: $3/1M input, $15/1M output
    const analysisCostCents = Math.ceil(
      ((inputTokens * 3) / 1_000_000 + (outputTokens * 15) / 1_000_000) * 100
    );

    // Insert analysis record
    const { error: analysisError } = await supabase
      .from("dynasty_call_analysis")
      .upsert(
        {
          call_id: call_id,
          overall_score: clamp(analysis.overall_score, 0, 10),
          rapport_score: clamp(analysis.rapport_score, 0, 10),
          objection_handling_score: clamp(analysis.objection_handling_score, 0, 10),
          qualification_score: clamp(analysis.qualification_score, 0, 10),
          closing_score: clamp(analysis.closing_score, 0, 10),
          energy_score: clamp(analysis.energy_score, 0, 10),
          what_went_well: analysis.what_went_well || [],
          what_to_improve: analysis.what_to_improve || [],
          missed_opportunities: analysis.missed_opportunities || [],
          best_moment: analysis.best_moment,
          worst_moment: analysis.worst_moment,
          specific_coaching: analysis.specific_coaching,
          script_adherence_percentage: clamp(analysis.script_adherence_percentage, 0, 100),
          talk_to_listen_ratio: clamp(analysis.talk_to_listen_ratio, 0, 100),
          objections_raised: analysis.objections_raised || [],
          objection_handling_grade: analysis.objection_handling_grade,
          objection_handling_notes: analysis.objection_handling_notes,
          recommended_followup: analysis.recommended_followup,
          callback_timing: analysis.callback_timing,
          suggested_talking_points: analysis.suggested_talking_points || [],
          customer_sentiment: analysis.customer_sentiment,
          rep_sentiment: analysis.rep_sentiment,
          key_moments: analysis.key_moments || [],
          analysis_version: "v1",
          claude_model: "claude-sonnet-4-20250514",
          analysis_cost_cents: analysisCostCents,
          analyzed_at: new Date().toISOString(),
        },
        { onConflict: "call_id" }
      );

    if (analysisError) {
      console.error("Error saving analysis:", analysisError);
      throw analysisError;
    }

    // Update call lead_quality based on analysis
    if (analysis.overall_score >= 7) {
      await supabase
        .from("dynasty_ai_calls")
        .update({ lead_quality: "hot" })
        .eq("call_id", call_id);
    }

    // Track objections in library
    if (analysis.objections_raised?.length > 0) {
      for (const objection of analysis.objections_raised) {
        const { data: existing } = await supabase
          .from("dynasty_objection_library")
          .select("id, times_encountered, times_overcome")
          .eq("business_unit", business_unit)
          .eq("objection_text", objection)
          .maybeSingle();

        if (existing) {
          const overcome =
            analysis.objection_handling_grade === "A" || analysis.objection_handling_grade === "B";
          await supabase
            .from("dynasty_objection_library")
            .update({
              times_encountered: (existing.times_encountered || 0) + 1,
              times_overcome: (existing.times_overcome || 0) + (overcome ? 1 : 0),
              success_rate:
                (((existing.times_overcome || 0) + (overcome ? 1 : 0)) /
                  ((existing.times_encountered || 0) + 1)) *
                100,
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("dynasty_objection_library").insert({
            business_unit: business_unit,
            objection_text: objection,
            objection_category: categorizeObjection(objection),
            times_encountered: 1,
            times_overcome:
              analysis.objection_handling_grade === "A" || analysis.objection_handling_grade === "B"
                ? 1
                : 0,
          });
        }
      }
    }

    console.log(
      `Analysis complete for ${call_id}: score=${analysis.overall_score}, cost=${analysisCostCents}¢`
    );

    return new Response(
      JSON.stringify({
        success: true,
        call_id,
        overall_score: analysis.overall_score,
        analysis_cost_cents: analysisCostCents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Call analyzer error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function clamp(val: unknown, min: number, max: number): number {
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function categorizeObjection(objection: string): string {
  const lower = objection.toLowerCase();
  if (lower.includes("price") || lower.includes("cost") || lower.includes("expensive") || lower.includes("budget"))
    return "price";
  if (lower.includes("time") || lower.includes("busy") || lower.includes("later") || lower.includes("not now"))
    return "timing";
  if (lower.includes("competitor") || lower.includes("already using") || lower.includes("other"))
    return "competition";
  if (lower.includes("boss") || lower.includes("manager") || lower.includes("decision") || lower.includes("partner"))
    return "authority";
  if (lower.includes("don't need") || lower.includes("no need") || lower.includes("not looking"))
    return "need";
  return "other";
}
