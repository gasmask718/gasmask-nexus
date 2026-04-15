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

    const prompt = getAnalysisPrompt(business_unit, transcript, duration_seconds, contact_name, company_name);

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.3,
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

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response:", rawContent.slice(0, 200));
      throw new Error("Failed to parse Claude analysis response");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    const inputTokens = claudeData.usage?.input_tokens || 0;
    const outputTokens = claudeData.usage?.output_tokens || 0;
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

    // Determine lead quality from analysis
    const leadQuality = analysis.lead_quality_assessment || 
      (analysis.overall_score >= 7 ? "hot" : analysis.overall_score >= 5 ? "warm" : "cold");
    const nextAction = analysis.recommended_next_action || "nurture";

    // Update call record with lead quality and next action
    await supabase
      .from("dynasty_ai_calls")
      .update({ lead_quality: leadQuality, next_action: nextAction })
      .eq("call_id", call_id);

    // If qualified (hot/warm), auto-create pipeline entry
    if (leadQuality === "hot" || leadQuality === "warm") {
      await createPipelineEntry(supabase, call_id, business_unit, analysis);
    }

    // Track objections in library
    if (analysis.objections_raised?.length > 0) {
      await updateObjectionLibrary(supabase, business_unit, analysis);
    }

    console.log(
      `Analysis complete for ${call_id}: score=${analysis.overall_score}, lead=${leadQuality}, cost=${analysisCostCents}¢`
    );

    return new Response(
      JSON.stringify({
        success: true,
        call_id,
        overall_score: analysis.overall_score,
        lead_quality: leadQuality,
        next_action: nextAction,
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

function getAnalysisPrompt(
  businessUnit: string,
  transcript: string,
  duration: number,
  contactName?: string,
  companyName?: string
): string {
  const basePrompt = `You are an expert sales coach analyzing a cold call.

BUSINESS UNIT: ${businessUnit}
CALL DURATION: ${duration} seconds
CONTACT: ${contactName || "Unknown"} | COMPANY: ${companyName || "Unknown"}

TRANSCRIPT:
${transcript}

Analyze this call comprehensively and return ONLY valid JSON (no markdown, no preamble) with this exact structure:

{
  "overall_score": <0-10>,
  "rapport_score": <0-10>,
  "objection_handling_score": <0-10>,
  "qualification_score": <0-10>,
  "closing_score": <0-10>,
  "energy_score": <0-10>,
  "what_went_well": ["point 1", "point 2", "point 3"],
  "what_to_improve": ["point 1", "point 2", "point 3"],
  "missed_opportunities": ["opportunity 1", "opportunity 2"],
  "best_moment": "quote from transcript",
  "worst_moment": "quote from transcript",
  "specific_coaching": "detailed coaching paragraph",
  "script_adherence_percentage": <0-100>,
  "talk_to_listen_ratio": <0-100>,
  "objections_raised": ["objection 1", "objection 2"],
  "objection_handling_grade": "A|B|C|D|F",
  "objection_handling_notes": "explanation",
  "recommended_followup": "specific next step",
  "callback_timing": "immediate|3_days|1_week|1_month|never",
  "suggested_talking_points": ["point 1", "point 2"],
  "customer_sentiment": "positive|neutral|negative|hostile",
  "rep_sentiment": "confident|uncertain|discouraged",
  "lead_quality_assessment": "hot|warm|cold|dead",
  "recommended_next_action": "assign_closer|schedule_callback|nurture|archive",
  "key_moments": [
    {"timestamp_seconds": 45, "label": "Strong objection raised", "type": "negative"},
    {"timestamp_seconds": 120, "label": "Good rapport moment", "type": "positive"}
  ]
}`;

  const businessContext: Record<string, string> = {
    brandaro: `
BRANDARO CONTEXT:
- Selling professional websites to businesses without one
- Price range: $500-$2,000
- Target: Local businesses (restaurants, contractors, retailers)
- Goal: Qualify interest, mention price, book closer call
- Red flags: "Already have a website", "No budget", "Not the decision maker"
- Green flags: Asking about price, timeline questions, competitor mentions`,
    surplus_funds: `
SURPLUS FUNDS CONTEXT:
- Recovering excess funds from foreclosure auctions (FL/TX/GA/NJ/OH/IL)
- Service: Attorney-backed recovery, contingency fee (30-40%)
- Target: Former property owners who lost homes to foreclosure
- Goal: Confirm they owned property, lost it, explain free money available
- Red flags: "Scam", "Not interested in past", angry/hostile
- Green flags: Asking "how much", "when", requesting documentation`,
    wholesale_re: `
WHOLESALE REAL ESTATE CONTEXT:
- Buying distressed properties from motivated sellers
- Target: Homeowners facing foreclosure, probate, divorce, job loss
- Goal: Build rapport, identify motivation, get property details
- Red flags: No urgency, retail price expectations, not decision maker
- Green flags: Time pressure, mentions "need to sell fast", motivated`,
    gasmask: `
GASMASK CONTEXT:
- Distribution and fulfillment operations
- Target: Retail stores and wholesale buyers
- Goal: Qualify store interest, confirm ordering details, schedule delivery
- Red flags: "Already stocked", "No shelf space", "Not buying right now"
- Green flags: Asking about pricing tiers, MOQ questions, delivery timelines`,
  };

  return basePrompt + (businessContext[businessUnit] || "");
}

async function createPipelineEntry(
  supabase: any,
  callId: string,
  businessUnit: string,
  analysis: any
) {
  const { data: call } = await supabase
    .from("dynasty_ai_calls")
    .select("contact_name, company_name, to_number")
    .eq("call_id", callId)
    .single();

  if (!call) return;

  // Check if pipeline entry already exists
  const { data: existing } = await supabase
    .from("dynasty_lead_pipeline")
    .select("id")
    .eq("call_id", callId)
    .maybeSingle();

  if (existing) return;

  await supabase.from("dynasty_lead_pipeline").insert({
    call_id: callId,
    business_unit: businessUnit,
    contact_name: call.contact_name,
    company_name: call.company_name,
    phone_number: call.to_number,
    stage: "new",
    pain_points: analysis.what_to_improve || [],
    next_followup_at: calculateFollowupTime(analysis.callback_timing),
  });
}

async function updateObjectionLibrary(
  supabase: any,
  businessUnit: string,
  analysis: any
) {
  for (const objection of analysis.objections_raised) {
    const { data: existing } = await supabase
      .from("dynasty_objection_library")
      .select("id, times_encountered, times_overcome")
      .eq("business_unit", businessUnit)
      .eq("objection_text", objection)
      .maybeSingle();

    const overcome =
      analysis.objection_handling_grade === "A" || analysis.objection_handling_grade === "B";

    if (existing) {
      const newEncountered = (existing.times_encountered || 0) + 1;
      const newOvercome = (existing.times_overcome || 0) + (overcome ? 1 : 0);
      await supabase
        .from("dynasty_objection_library")
        .update({
          times_encountered: newEncountered,
          times_overcome: newOvercome,
          success_rate: (newOvercome / newEncountered) * 100,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("dynasty_objection_library").insert({
        business_unit: businessUnit,
        objection_text: objection,
        objection_category: categorizeObjection(objection),
        times_encountered: 1,
        times_overcome: overcome ? 1 : 0,
        success_rate: overcome ? 100 : 0,
      });
    }
  }
}

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
  if (lower.includes("competitor") || lower.includes("already using") || lower.includes("already have") || lower.includes("other"))
    return "competition";
  if (lower.includes("boss") || lower.includes("manager") || lower.includes("decision") || lower.includes("partner") || lower.includes("not my"))
    return "authority";
  if (lower.includes("don't need") || lower.includes("no need") || lower.includes("not looking") || lower.includes("not interested"))
    return "need";
  return "other";
}

function calculateFollowupTime(timing: string): string {
  const now = Date.now();
  const hour = 3_600_000;
  switch (timing) {
    case "immediate":
      return new Date(now + hour).toISOString();
    case "3_days":
      return new Date(now + hour * 72).toISOString();
    case "1_week":
      return new Date(now + hour * 168).toISOString();
    case "1_month":
      return new Date(now + hour * 720).toISOString();
    default:
      return new Date(now + hour * 168).toISOString();
  }
}
