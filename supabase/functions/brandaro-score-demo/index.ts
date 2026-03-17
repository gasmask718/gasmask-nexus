import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * brandaro-score-demo
 * 
 * Quality control gate for demos before they're sent to leads.
 * Analyzes HTML content for design quality, CTA presence, mobile readiness.
 * 
 * Actions:
 *   - score: Score a single demo
 *   - batch_score: Score all unscored demos
 *   - get_design_insights: Return winning design patterns from closed deals
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    if (body.dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = body;

    switch (action) {
      case "score":
        return await handleScore(supabase, body);
      case "batch_score":
        return await handleBatchScore(supabase);
      case "get_design_insights":
        return await handleDesignInsights(supabase);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("brandaro-score-demo error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleScore(supabase: any, body: any) {
  const { demo_id, lead_id, html_content } = body;

  if (!html_content) {
    return new Response(JSON.stringify({ error: "html_content required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Score using AI if available, fallback to heuristics
  let scores = await scoreWithAI(html_content);
  if (!scores) {
    scores = heuristicScore(html_content);
  }

  const overallScore = Math.round(
    (scores.design_score * 0.4) +
    (scores.uniqueness_score * 0.2) +
    (scores.conversion_score * 0.4)
  );

  const flagged = overallScore < 70;

  const { data: record, error } = await supabase
    .from("brandaro_demo_quality_scores")
    .insert({
      demo_id,
      lead_id,
      design_score: scores.design_score,
      uniqueness_score: scores.uniqueness_score,
      conversion_score: scores.conversion_score,
      cta_present: scores.cta_present,
      mobile_friendly: scores.mobile_friendly,
      overall_score: overallScore,
      flagged,
      review_notes: flagged ? "Auto-flagged: score below 70. Review before sending." : null,
    })
    .select()
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({
    success: true,
    score_id: record.id,
    overall_score: overallScore,
    flagged,
    allow_send: !flagged,
    scores,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function scoreWithAI(html: string): Promise<any | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    // Truncate HTML to avoid token limits
    const truncated = html.substring(0, 8000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a web design quality analyst. Score website demos for a website agency."
          },
          {
            role: "user",
            content: `Score this website demo HTML:\n\n${truncated}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "score_demo",
            description: "Return quality scores for the demo",
            parameters: {
              type: "object",
              properties: {
                design_score: { type: "number", description: "0-100 visual quality, layout, typography, color harmony" },
                uniqueness_score: { type: "number", description: "0-100 how unique vs generic template" },
                conversion_score: { type: "number", description: "0-100 likelihood to convert a visitor (CTAs, trust signals, clarity)" },
                cta_present: { type: "boolean", description: "Has clear call-to-action buttons" },
                mobile_friendly: { type: "boolean", description: "Uses responsive/mobile-friendly patterns" },
              },
              required: ["design_score", "uniqueness_score", "conversion_score", "cta_present", "mobile_friendly"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "score_demo" } },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) return JSON.parse(toolCall.function.arguments);
    }
  } catch (e) {
    console.error("AI scoring failed:", e);
  }

  return null;
}

function heuristicScore(html: string): any {
  const lower = html.toLowerCase();
  
  // Design score
  let design = 50;
  if (/gradient|linear-gradient|radial-gradient/i.test(lower)) design += 10;
  if (/font-family|google.*fonts/i.test(lower)) design += 10;
  if (/box-shadow|shadow/i.test(lower)) design += 5;
  if (/<img/i.test(lower)) design += 10;
  if (/animation|transition|transform/i.test(lower)) design += 5;
  if (/<style/i.test(lower) || /tailwind|css/i.test(lower)) design += 10;

  // Uniqueness
  let uniqueness = 40;
  const htmlLength = html.length;
  if (htmlLength > 5000) uniqueness += 15;
  if (htmlLength > 10000) uniqueness += 10;
  if (/custom|unique|brand/i.test(lower)) uniqueness += 10;

  // Conversion
  let conversion = 40;
  const ctaPresent = /call.*now|get.*started|book.*now|contact.*us|schedule|learn.*more|sign.*up|order.*now|buy.*now|get.*quote/i.test(lower);
  if (ctaPresent) conversion += 25;
  if (/testimonial|review|rating|star/i.test(lower)) conversion += 10;
  if (/phone|tel:|email|mailto:/i.test(lower)) conversion += 10;
  if (/guarantee|free|limited|special/i.test(lower)) conversion += 5;

  // Mobile
  const mobileFriendly = /viewport|responsive|@media|flex|grid/i.test(lower);
  if (mobileFriendly) design += 5;

  return {
    design_score: Math.min(100, design),
    uniqueness_score: Math.min(100, uniqueness),
    conversion_score: Math.min(100, conversion),
    cta_present: ctaPresent,
    mobile_friendly: mobileFriendly,
  };
}

async function handleBatchScore(supabase: any) {
  // Fetch demos without scores
  const { data: demos } = await supabase
    .from("brandaro_qualified_leads")
    .select("id, demo_html")
    .eq("demo_status", "completed")
    .not("demo_html", "is", null)
    .limit(20);

  let scored = 0;
  for (const demo of (demos || [])) {
    // Check if already scored
    const { data: existing } = await supabase
      .from("brandaro_demo_quality_scores")
      .select("id")
      .eq("lead_id", demo.id)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const scores = heuristicScore(demo.demo_html);
    const overall = Math.round(scores.design_score * 0.4 + scores.uniqueness_score * 0.2 + scores.conversion_score * 0.4);

    await supabase.from("brandaro_demo_quality_scores").insert({
      lead_id: demo.id,
      design_score: scores.design_score,
      uniqueness_score: scores.uniqueness_score,
      conversion_score: scores.conversion_score,
      cta_present: scores.cta_present,
      mobile_friendly: scores.mobile_friendly,
      overall_score: overall,
      flagged: overall < 70,
    });

    scored++;
  }

  return new Response(JSON.stringify({ success: true, demos_scored: scored }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Phase 14: Design Learning
async function handleDesignInsights(supabase: any) {
  // Get design data from closed deals
  const { data: closedDeals } = await supabase
    .from("brandaro_close_pipeline")
    .select("*, brandaro_demo_quality_scores:brandaro_demo_quality_scores(design_score, uniqueness_score, conversion_score)")
    .eq("stage", "closed")
    .gt("revenue_amount", 0)
    .order("revenue_amount", { ascending: false })
    .limit(50);

  // Aggregate winning design patterns
  const patterns = {
    avg_design_score: 0,
    avg_conversion_score: 0,
    top_colors: [] as string[],
    top_layouts: [] as string[],
    top_cta_styles: [] as string[],
    total_revenue: 0,
    deal_count: 0,
  };

  for (const deal of (closedDeals || [])) {
    patterns.deal_count++;
    patterns.total_revenue += deal.revenue_amount || 0;
    if (deal.design_colors) patterns.top_colors.push(...deal.design_colors);
    if (deal.design_layout) patterns.top_layouts.push(deal.design_layout);
    if (deal.design_cta_style) patterns.top_cta_styles.push(deal.design_cta_style);
  }

  return new Response(JSON.stringify({ success: true, insights: patterns }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
