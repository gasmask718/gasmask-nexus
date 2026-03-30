import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_RULES = [
  { tier: "legend", minConversions: 50, rate: 22 },
  { tier: "elite", minConversions: 20, rate: 20 },
  { tier: "rising", minConversions: 5, rate: 17 },
  { tier: "starter", minConversions: 0, rate: 15 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Fetch all active ambassadors
    const { data: ambassadors, error } = await supabase
      .from("unforgettable_ambassadors")
      .select("*")
      .in("status", ["active", "approved"]);

    if (error) throw error;

    const insights: { ambassador_id: string; insight_type: string; insight_text: string; severity: string }[] = [];
    const updates: { id: string; performance_tier: string; commission_rate: number; conversion_rate: number; is_boosted: boolean; risk_level: string }[] = [];

    for (const amb of ambassadors || []) {
      const totalRefs = Number(amb.total_referrals || 0);
      const totalConv = Number(amb.total_converted_referrals || 0);
      const totalRev = Number(amb.total_revenue || 0);
      const convRate = totalRefs > 0 ? totalConv / totalRefs : 0;

      // Determine tier
      const tierRule = TIER_RULES.find(t => totalConv >= t.minConversions) || TIER_RULES[3];
      const newTier = tierRule.tier;
      const newRate = amb.auto_managed ? tierRule.rate : amb.commission_rate;

      // Boosted = top performer
      const isBoosted = totalConv >= 20 && convRate >= 0.15;

      // Risk detection
      let riskLevel = "low";
      if (totalRefs > 50 && totalConv === 0) riskLevel = "high";
      else if (totalRefs > 20 && convRate < 0.02) riskLevel = "medium";

      updates.push({
        id: amb.id,
        performance_tier: newTier,
        commission_rate: newRate,
        conversion_rate: Math.round(convRate * 10000) / 100,
        is_boosted: isBoosted,
        risk_level: riskLevel,
      });

      // Generate insights
      if (newTier !== amb.performance_tier) {
        insights.push({
          ambassador_id: amb.id,
          insight_type: "tier_change",
          insight_text: `${amb.full_name} upgraded to ${newTier.toUpperCase()} tier (${totalConv} conversions)`,
          severity: "success",
        });
      }

      if (riskLevel === "high") {
        insights.push({
          ambassador_id: amb.id,
          insight_type: "risk_alert",
          insight_text: `${amb.full_name} has ${totalRefs} clicks but 0 conversions — possible fraud or bad targeting`,
          severity: "warning",
        });
      }

      if (isBoosted && !amb.is_boosted) {
        insights.push({
          ambassador_id: amb.id,
          insight_type: "boost",
          insight_text: `${amb.full_name} qualifies for BOOST status — high conversion rate (${(convRate * 100).toFixed(1)}%)`,
          severity: "success",
        });
      }

      if (totalRefs > 10 && convRate < 0.05 && convRate > 0) {
        insights.push({
          ambassador_id: amb.id,
          insight_type: "optimization",
          insight_text: `${amb.full_name} has low conversion rate (${(convRate * 100).toFixed(1)}%) — recommend improving landing page or targeting`,
          severity: "info",
        });
      }

      // Inactivity check
      const lastConv = amb.last_conversion_at ? new Date(amb.last_conversion_at).getTime() : 0;
      const daysSinceConv = lastConv ? (Date.now() - lastConv) / 86400000 : 999;
      if (totalConv > 0 && daysSinceConv > 30) {
        insights.push({
          ambassador_id: amb.id,
          insight_type: "re_engagement",
          insight_text: `${amb.full_name} hasn't converted in ${Math.floor(daysSinceConv)} days — send re-engagement`,
          severity: "info",
        });
      }
    }

    // Batch update ambassadors
    for (const u of updates) {
      await supabase.from("unforgettable_ambassadors").update({
        performance_tier: u.performance_tier,
        commission_rate: u.commission_rate,
        conversion_rate: u.conversion_rate,
        is_boosted: u.is_boosted,
        risk_level: u.risk_level,
        last_insight_at: new Date().toISOString(),
      }).eq("id", u.id);
    }

    // Insert new insights
    if (insights.length > 0) {
      await supabase.from("ut_ambassador_insights").insert(insights);
    }

    // Send re-engagement SMS for inactive ambassadors
    const reEngageInsights = insights.filter(i => i.insight_type === "re_engagement");
    for (const insight of reEngageInsights.slice(0, 5)) {
      const amb = (ambassadors || []).find(a => a.id === insight.ambassador_id);
      if (amb?.phone) {
        try {
          await supabase.functions.invoke("ambassador-notify", {
            body: {
              event: "re_engagement",
              ambassador_id: amb.id,
              name: amb.full_name,
              phone: amb.phone,
            },
          });
        } catch {}
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: updates.length,
      insights_generated: insights.length,
      tier_changes: insights.filter(i => i.insight_type === "tier_change").length,
      risk_alerts: insights.filter(i => i.insight_type === "risk_alert").length,
      boosts: insights.filter(i => i.insight_type === "boost").length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Insights error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
