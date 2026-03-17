import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * brandaro-track-performance
 * 
 * Ingests engagement data from deployed sites and updates template scores.
 * Called by tracking scripts embedded in production sites.
 * Also runs scoring recalculation when triggered with action=recalculate.
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

    // ACTION 1: Ingest engagement event
    if (action === "ingest" || !action) {
      const { template_id, build_job_id, client_id, event_type, event_value } = body;

      if (!build_job_id) {
        return new Response(JSON.stringify({ error: "build_job_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find template performance record for this build
      const { data: perfRecord } = await supabase
        .from("brandaro_template_performance")
        .select("*")
        .eq("build_job_id", build_job_id)
        .single();

      if (!perfRecord && template_id) {
        // Create one if it doesn't exist
        await supabase.from("brandaro_template_performance").insert({
          template_id,
          build_job_id,
          client_id,
        });
      }

      // Update engagement metrics based on event type
      if (perfRecord) {
        const updates: Record<string, any> = { updated_at: new Date().toISOString() };

        if (event_type === "scroll_depth") {
          const depth = parseFloat(event_value) || 0;
          updates.avg_scroll_depth = Math.max(perfRecord.avg_scroll_depth || 0, depth);
        }
        if (event_type === "session_duration") {
          const seconds = parseFloat(event_value) || 0;
          // Running average
          const current = perfRecord.avg_engagement_seconds || 0;
          const count = perfRecord.usage_count || 1;
          updates.avg_engagement_seconds = ((current * (count - 1)) + seconds) / count;
        }
        if (event_type === "form_submit" || event_type === "cta_click") {
          // Increment conversion signals
          const currentRate = perfRecord.conversion_rate || 0;
          updates.conversion_rate = currentRate + 1; // raw count, normalized during scoring
        }
        if (event_type === "lead_generated") {
          const currentRate = perfRecord.lead_generation_rate || 0;
          updates.lead_generation_rate = currentRate + 1;
        }

        await supabase
          .from("brandaro_template_performance")
          .update(updates)
          .eq("id", perfRecord.id);
      }

      return new Response(JSON.stringify({ ok: true, ingested: event_type }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION 2: Recalculate all template scores
    if (action === "recalculate") {
      const { data: allPerf } = await supabase
        .from("brandaro_template_performance")
        .select("*")
        .gt("usage_count", 0);

      if (!allPerf || allPerf.length === 0) {
        return new Response(JSON.stringify({ ok: true, message: "No templates to score" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find max values for normalization
      const maxConversion = Math.max(...allPerf.map((p: any) => p.conversion_rate || 0), 1);
      const maxEngagement = Math.max(...allPerf.map((p: any) => p.avg_engagement_seconds || 0), 1);
      const maxScroll = Math.max(...allPerf.map((p: any) => p.avg_scroll_depth || 0), 1);
      const maxLeads = Math.max(...allPerf.map((p: any) => p.lead_generation_rate || 0), 1);

      let updated = 0;
      for (const perf of allPerf) {
        // Weighted score calculation
        const conversionScore = ((perf.conversion_rate || 0) / maxConversion) * 40;
        const engagementScore = ((perf.avg_engagement_seconds || 0) / maxEngagement) * 30;
        const scrollScore = ((perf.avg_scroll_depth || 0) / maxScroll) * 10;
        const leadScore = ((perf.lead_generation_rate || 0) / maxLeads) * 20;

        const totalScore = Math.round(conversionScore + engagementScore + scrollScore + leadScore);

        const breakdown = {
          conversion: Math.round(conversionScore),
          engagement: Math.round(engagementScore),
          scroll_depth: Math.round(scrollScore),
          lead_generation: Math.round(leadScore),
        };

        await supabase
          .from("brandaro_template_performance")
          .update({
            template_score: totalScore,
            score_breakdown: breakdown,
            last_scored_at: new Date().toISOString(),
          })
          .eq("id", perf.id);

        // Update parent template avg_score
        if (perf.template_id) {
          await supabase
            .from("brandaro_extracted_templates")
            .update({ avg_score: totalScore })
            .eq("id", perf.template_id);
        }

        updated++;
      }

      // Recalculate design profile performance ranks
      await recalculateProfileRanks(supabase);

      return new Response(JSON.stringify({ ok: true, templates_scored: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[TRACK-PERFORMANCE] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function recalculateProfileRanks(supabase: any) {
  const { data: profiles } = await supabase
    .from("brandaro_design_profiles")
    .select("id, style_category")
    .eq("is_active", true);

  if (!profiles) return;

  for (const profile of profiles) {
    // Get all build jobs that used this profile
    const { data: jobs } = await supabase
      .from("brandaro_build_jobs")
      .select("quality_score")
      .eq("design_profile_id", profile.id)
      .not("quality_score", "is", null);

    if (jobs && jobs.length > 0) {
      const avgConversion = jobs.reduce((s: number, j: any) => s + (j.quality_score || 0), 0) / jobs.length;
      await supabase
        .from("brandaro_design_profiles")
        .update({
          avg_conversion_rate: Math.round(avgConversion * 100) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
    }
  }

  // Assign ranks
  const { data: ranked } = await supabase
    .from("brandaro_design_profiles")
    .select("id")
    .eq("is_active", true)
    .order("avg_conversion_rate", { ascending: false });

  if (ranked) {
    for (let i = 0; i < ranked.length; i++) {
      await supabase
        .from("brandaro_design_profiles")
        .update({ performance_rank: i + 1 })
        .eq("id", ranked[i].id);
    }
  }
}
