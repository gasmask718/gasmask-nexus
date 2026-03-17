import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * brandaro-analyze-site
 * 
 * Analyzes a website URL and extracts abstracted conversion patterns.
 * Does NOT copy HTML — extracts structural, psychological, and flow patterns.
 * Uses Lovable AI (Gemini) for intelligent pattern extraction.
 * 
 * Actions:
 *   analyze — analyze a URL and store patterns
 *   recalculate — update pattern scores from build performance data
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
    const { action, dry_run } = body;

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Analyze a website
    if (action === "analyze") {
      const { url, industry_type } = body;
      if (!url) {
        return new Response(JSON.stringify({ error: "url required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch the page HTML
      let pageHtml = "";
      try {
        const pageResp = await fetch(url, {
          headers: { "User-Agent": "Brandaro-Analyzer/1.0" },
        });
        pageHtml = await pageResp.text();
      } catch (fetchErr) {
        return new Response(JSON.stringify({ error: `Failed to fetch URL: ${fetchErr.message}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Truncate HTML to avoid token limits
      const truncatedHtml = pageHtml.substring(0, 15000);

      // Use AI to extract conversion patterns (NOT copy HTML)
      const systemPrompt = `You are a conversion rate optimization expert. Analyze the provided website HTML and extract ABSTRACT conversion patterns. Do NOT copy any HTML, text, or design. Instead, identify the STRUCTURAL and PSYCHOLOGICAL mechanisms that drive conversions.

Extract these pattern types:
- cta_placement: where and how CTAs are positioned
- trust_element: what trust signals are used and where
- headline_pattern: the structure/formula of headlines (not the actual text)
- section_order: the sequence of page sections
- social_proof: how social proof is presented
- risk_reversal: guarantees, free offers, etc.
- form_placement: where forms appear, how many fields
- urgency_trigger: scarcity or time-pressure elements

For each pattern, provide:
- pattern_type (from above)
- pattern_key (unique snake_case identifier)
- pattern_data (structured JSON describing the abstract pattern)
- effectiveness_estimate (0-100)`;

      const userPrompt = `Analyze this website HTML and extract conversion patterns. Industry: ${industry_type || "unknown"}. URL: ${url}

HTML (truncated):
${truncatedHtml}

Return ONLY structured patterns. No HTML copying.`;

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
              name: "return_patterns",
              description: "Return extracted conversion patterns",
              parameters: {
                type: "object",
                properties: {
                  patterns: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        pattern_type: { type: "string" },
                        pattern_key: { type: "string" },
                        pattern_data: { type: "object" },
                        effectiveness_estimate: { type: "number" },
                      },
                      required: ["pattern_type", "pattern_key", "pattern_data", "effectiveness_estimate"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["patterns"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_patterns" } },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("[ANALYZE-SITE] AI error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ error: "AI analysis failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(JSON.stringify({ error: "No patterns extracted" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsed = JSON.parse(toolCall.function.arguments);
      const patterns = parsed.patterns || [];

      // Upsert patterns into database
      let inserted = 0;
      let updated = 0;

      for (const p of patterns) {
        const key = p.pattern_key;
        const ind = industry_type || null;

        // Check if pattern exists
        const { data: existing } = await supabase
          .from("brandaro_conversion_patterns")
          .select("id, usage_frequency, pattern_score")
          .eq("pattern_key", key)
          .eq("industry_type", ind)
          .maybeSingle();

        if (existing) {
          // Update: increase frequency and blend score
          const newFreq = (existing.usage_frequency || 0) + 1;
          const blendedScore = Math.round(
            (existing.pattern_score * 0.7) + (p.effectiveness_estimate * 0.3)
          );
          await supabase.from("brandaro_conversion_patterns").update({
            usage_frequency: newFreq,
            pattern_score: blendedScore,
            pattern_data: p.pattern_data,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
          updated++;
        } else {
          // Insert new pattern
          await supabase.from("brandaro_conversion_patterns").insert({
            pattern_type: p.pattern_type,
            pattern_key: key,
            industry_type: ind,
            pattern_data: p.pattern_data,
            source_url: url,
            source_quality: "unverified",
            usage_frequency: 1,
            pattern_score: p.effectiveness_estimate,
          });
          inserted++;
        }
      }

      console.log(`[ANALYZE-SITE] Extracted ${patterns.length} patterns from ${url} (${inserted} new, ${updated} updated)`);

      return new Response(JSON.stringify({
        ok: true,
        url,
        patterns_found: patterns.length,
        inserted,
        updated,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION: Recalculate pattern scores from actual build performance
    if (action === "recalculate") {
      const { data: buildPatterns } = await supabase
        .from("brandaro_build_patterns")
        .select("pattern_id, resulted_in_conversion, engagement_delta");

      if (!buildPatterns || buildPatterns.length === 0) {
        return new Response(JSON.stringify({ ok: true, message: "No build pattern data yet" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Aggregate by pattern_id
      const patternStats: Record<string, { uses: number; conversions: number; totalEngagement: number }> = {};
      for (const bp of buildPatterns) {
        if (!bp.pattern_id) continue;
        if (!patternStats[bp.pattern_id]) {
          patternStats[bp.pattern_id] = { uses: 0, conversions: 0, totalEngagement: 0 };
        }
        patternStats[bp.pattern_id].uses++;
        if (bp.resulted_in_conversion) patternStats[bp.pattern_id].conversions++;
        patternStats[bp.pattern_id].totalEngagement += bp.engagement_delta || 0;
      }

      let recalculated = 0;
      for (const [patternId, stats] of Object.entries(patternStats)) {
        const conversionRate = stats.uses > 0 ? stats.conversions / stats.uses : 0;
        const avgEngagement = stats.uses > 0 ? stats.totalEngagement / stats.uses : 0;

        // Blend: 50% conversion correlation, 30% engagement, 20% existing score
        const { data: existing } = await supabase
          .from("brandaro_conversion_patterns")
          .select("pattern_score")
          .eq("id", patternId)
          .single();

        if (existing) {
          const newScore = Math.round(
            (conversionRate * 100 * 0.5) +
            (Math.min(avgEngagement, 100) * 0.3) +
            ((existing.pattern_score || 50) * 0.2)
          );

          await supabase.from("brandaro_conversion_patterns").update({
            pattern_score: Math.max(0, Math.min(100, newScore)),
            conversion_correlation: Math.round(conversionRate * 100),
            engagement_boost: Math.round(avgEngagement),
            times_used_in_builds: stats.uses,
            updated_at: new Date().toISOString(),
          }).eq("id", patternId);
          recalculated++;
        }
      }

      return new Response(JSON.stringify({ ok: true, patterns_recalculated: recalculated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use 'analyze' or 'recalculate'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ANALYZE-SITE] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
