import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_RULES = [
  { tier: "legend", minConversions: 50, minRevenue: 10000, rate: 22 },
  { tier: "elite", minConversions: 20, minRevenue: 2500, rate: 20 },
  { tier: "rising", minConversions: 5, minRevenue: 500, rate: 17 },
  { tier: "starter", minConversions: 0, minRevenue: 0, rate: 15 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results = {
    processed: 0,
    tier_changes: 0,
    boosts_applied: 0,
    risk_flags: 0,
    insights_generated: 0,
    reengagement_sent: 0,
    errors: [] as string[],
  };

  try {
    // Fetch all ambassadors
    const { data: ambassadors, error: ambErr } = await supabase
      .from("unforgettable_ambassadors")
      .select("*")
      .in("status", ["active", "approved", "pending"]);

    if (ambErr) throw ambErr;
    if (!ambassadors || ambassadors.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No ambassadors to process", ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch referral data for metrics
    const { data: allReferrals } = await supabase
      .from("ut_ambassador_referrals")
      .select("ambassador_id, status, revenue_amount, commission_amount");

    // Build referral aggregates per ambassador
    const refMap = new Map<string, { clicks: number; leads: number; conversions: number; revenue: number; commissions: number }>();
    for (const ref of allReferrals || []) {
      const agg = refMap.get(ref.ambassador_id) || { clicks: 0, leads: 0, conversions: 0, revenue: 0, commissions: 0 };
      agg.clicks++;
      if (ref.status === "lead") agg.leads++;
      if (ref.status === "converted") {
        agg.conversions++;
        agg.revenue += Number(ref.revenue_amount || 0);
        agg.commissions += Number(ref.commission_amount || 0);
      }
      refMap.set(ref.ambassador_id, agg);
    }

    // Fetch existing active insights to avoid duplicates
    const { data: existingInsights } = await supabase
      .from("ut_ambassador_insights")
      .select("ambassador_id, insight_type")
      .is("dismissed_at", null);

    const activeInsightSet = new Set(
      (existingInsights || []).map(i => `${i.ambassador_id}:${i.insight_type}`)
    );

    const newInsights: any[] = [];
    const now = new Date().toISOString();

    for (const amb of ambassadors) {
      results.processed++;

      const agg = refMap.get(amb.id) || { clicks: 0, leads: 0, conversions: 0, revenue: 0, commissions: 0 };
      const totalClicks = agg.clicks;
      const totalLeads = agg.leads;
      const totalConversions = agg.conversions;
      const totalRevenue = agg.revenue;
      const totalCommissions = agg.commissions;
      const convRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
      const avgRevPerConv = totalConversions > 0 ? totalRevenue / totalConversions : 0;
      const revPerClick = totalClicks > 0 ? totalRevenue / totalClicks : 0;
      const earnPerClick = totalClicks > 0 ? totalCommissions / totalClicks : 0;

      // Metrics update
      const metricsUpdate: any = {
        total_clicks: totalClicks,
        total_leads: totalLeads,
        total_conversions: totalConversions,
        total_referrals: totalClicks,
        total_converted_referrals: totalConversions,
        total_revenue: totalRevenue,
        total_commissions: totalCommissions,
        conversion_rate: Math.round(convRate * 100) / 100,
        avg_revenue_per_conversion: Math.round(avgRevPerConv * 100) / 100,
        revenue_per_click: Math.round(revPerClick * 100) / 100,
        earnings_per_click: Math.round(earnPerClick * 100) / 100,
        last_insight_at: now,
      };

      // Tier assignment (skip if locked)
      if (!amb.is_tier_locked) {
        const tierRule = TIER_RULES.find(t =>
          totalConversions >= t.minConversions || totalRevenue >= t.minRevenue
        ) || TIER_RULES[3];

        if (tierRule.tier !== amb.performance_tier) {
          results.tier_changes++;
          metricsUpdate.tier_updated_at = now;

          // Only add insight if not duplicate
          const insightKey = `${amb.id}:tier_change`;
          if (!activeInsightSet.has(insightKey)) {
            newInsights.push({
              ambassador_id: amb.id,
              insight_type: "tier_change",
              insight_text: `${amb.full_name} moved to ${tierRule.tier.toUpperCase()} tier (${totalConversions} conversions, $${totalRevenue.toFixed(0)} revenue)`,
              severity: "success",
              priority: 2,
            });
            activeInsightSet.add(insightKey);
          }
        }

        metricsUpdate.performance_tier = tierRule.tier;
        if (amb.auto_managed !== false) {
          metricsUpdate.commission_rate = tierRule.rate;
        }
      }

      // Boost logic
      const isBoosted = totalConversions >= 10 && convRate >= 10;
      let boostReason: string | null = null;
      if (isBoosted) {
        boostReason = `Top performer: ${totalConversions} conversions, ${convRate.toFixed(1)}% rate, $${totalRevenue.toFixed(0)} revenue`;
        if (!amb.is_boosted) results.boosts_applied++;
      }
      metricsUpdate.is_boosted = isBoosted;
      metricsUpdate.boost_reason = boostReason;
      metricsUpdate.boost_updated_at = now;

      if (isBoosted && !amb.is_boosted) {
        const insightKey = `${amb.id}:boost`;
        if (!activeInsightSet.has(insightKey)) {
          newInsights.push({
            ambassador_id: amb.id,
            insight_type: "boost",
            insight_text: `${amb.full_name} earned BOOST status — strong conversion rate (${convRate.toFixed(1)}%) and ${totalConversions} conversions`,
            severity: "success",
            priority: 3,
          });
          activeInsightSet.add(insightKey);
        }
      }

      // Risk detection
      let riskLevel = "low";
      let riskReason: string | null = null;

      if (totalClicks > 50 && totalConversions === 0 && totalLeads === 0) {
        riskLevel = "high";
        riskReason = `${totalClicks} clicks with zero leads/conversions — possible fraud or bot traffic`;
        results.risk_flags++;
      } else if (totalClicks > 20 && convRate < 2 && totalConversions > 0) {
        riskLevel = "medium";
        riskReason = `Very low conversion rate (${convRate.toFixed(1)}%) with ${totalClicks} clicks`;
      } else if (totalClicks > 30 && totalLeads > 10 && totalConversions === 0) {
        riskLevel = "medium";
        riskReason = `${totalLeads} leads but zero conversions — possible low-quality traffic`;
      }

      metricsUpdate.risk_level = riskLevel;
      metricsUpdate.risk_reason = riskReason;
      metricsUpdate.risk_updated_at = now;

      if (riskLevel === "high") {
        const insightKey = `${amb.id}:risk_alert`;
        if (!activeInsightSet.has(insightKey)) {
          newInsights.push({
            ambassador_id: amb.id,
            insight_type: "risk_alert",
            insight_text: `⚠️ ${amb.full_name}: ${riskReason}`,
            severity: "warning",
            priority: 4,
          });
          activeInsightSet.add(insightKey);
        }
      }

      // Low conversion optimization insight
      if (totalClicks > 10 && convRate < 5 && convRate > 0) {
        const insightKey = `${amb.id}:optimization`;
        if (!activeInsightSet.has(insightKey)) {
          newInsights.push({
            ambassador_id: amb.id,
            insight_type: "optimization",
            insight_text: `${amb.full_name} has low conversion rate (${convRate.toFixed(1)}%) — recommend reviewing funnel quality or targeting`,
            severity: "info",
            priority: 1,
          });
          activeInsightSet.add(insightKey);
        }
      }

      // High performer insight
      if (totalConversions >= 20 && convRate >= 15) {
        const insightKey = `${amb.id}:high_performer`;
        if (!activeInsightSet.has(insightKey)) {
          newInsights.push({
            ambassador_id: amb.id,
            insight_type: "high_performer",
            insight_text: `🌟 ${amb.full_name} is a star performer — consider increasing commission or offering VIP perks`,
            severity: "success",
            priority: 3,
          });
          activeInsightSet.add(insightKey);
        }
      }

      // Re-engagement check (active, no activity 14+ days)
      if (amb.status === "active" || amb.status === "approved") {
        const lastActivity = amb.last_conversion_at || amb.approved_at || amb.created_at;
        const daysSince = lastActivity ? (Date.now() - new Date(lastActivity).getTime()) / 86400000 : 999;
        const lastReengaged = amb.last_reengagement_at ? new Date(amb.last_reengagement_at).getTime() : 0;
        const daysSinceReengagement = lastReengaged ? (Date.now() - lastReengaged) / 86400000 : 999;

        if (daysSince >= 14 && daysSinceReengagement >= 14 && amb.phone) {
          // Send re-engagement SMS
          try {
            await supabase.functions.invoke("ambassador-notify", {
              body: {
                event: "re_engagement",
                ambassador_id: amb.id,
                name: amb.full_name,
                phone: amb.phone,
              },
            });
            metricsUpdate.last_reengagement_at = now;
            results.reengagement_sent++;

            const insightKey = `${amb.id}:re_engagement`;
            if (!activeInsightSet.has(insightKey)) {
              newInsights.push({
                ambassador_id: amb.id,
                insight_type: "re_engagement",
                insight_text: `Re-engagement SMS sent to ${amb.full_name} — inactive for ${Math.floor(daysSince)} days`,
                severity: "info",
                priority: 1,
              });
              activeInsightSet.add(insightKey);
            }
          } catch (smsErr) {
            console.error(`Re-engagement SMS failed for ${amb.id}:`, smsErr);
          }
        }
      }

      // Apply update
      const { error: updateErr } = await supabase
        .from("unforgettable_ambassadors")
        .update(metricsUpdate)
        .eq("id", amb.id);

      if (updateErr) {
        results.errors.push(`Update failed for ${amb.id}: ${updateErr.message}`);
      }
    }

    // Insert new insights (deduplicated)
    if (newInsights.length > 0) {
      const { error: insightErr } = await supabase.from("ut_ambassador_insights").insert(newInsights);
      if (insightErr) results.errors.push(`Insights insert failed: ${insightErr.message}`);
      results.insights_generated = newInsights.length;
    }

    // Log the optimization run
    await supabase.from("system_operation_logs").insert({
      system_name: "ut_ambassador_pipeline",
      operation_type: "daily_optimization",
      success: results.errors.length === 0,
      details: results,
    });

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Optimization error:", err);

    await supabase.from("system_operation_logs").insert({
      system_name: "ut_ambassador_pipeline",
      operation_type: "daily_optimization",
      success: false,
      details: { error: err.message },
    }).catch(() => {});

    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
