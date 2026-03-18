import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action } = await req.json();

    // ── GET CONFIG ──
    const { data: configRows } = await supabase.from("brandaro_autopilot_config").select("*").limit(1);
    const config = configRows?.[0] || {
      reinvestment_pct: 30, min_roi_to_scale: 100,
      max_budget_per_campaign: 5000, stop_loss_threshold: -20,
      auto_kill_enabled: true, auto_scale_enabled: true,
    };

    // ── ACTION: FULL CYCLE ──
    if (action === "full-cycle") {
      // 1. Revenue Attribution — pull closed deals and attribute to source
      const { data: closedDeals } = await supabase
        .from("brandaro_revenue_attribution")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      const allDeals = closedDeals || [];
      const totalRevenue = allDeals.reduce((s: number, d: any) => s + Number(d.revenue_generated || 0), 0);

      // 2. Channel Performance — aggregate by channel
      const channelPerf: Record<string, { revenue: number; cost: number; leads: number; deals: number }> = {};
      allDeals.forEach((d: any) => {
        const ch = d.channel || "organic";
        if (!channelPerf[ch]) channelPerf[ch] = { revenue: 0, cost: 0, leads: 0, deals: 0 };
        channelPerf[ch].revenue += Number(d.revenue_generated || 0);
        channelPerf[ch].cost += Number(d.cost_per_lead || 0);
        channelPerf[ch].leads++;
        channelPerf[ch].deals++;
      });

      // 3. Campaign Performance — aggregate by campaign
      const campaignPerf: Record<string, { revenue: number; cost: number; leads: number; name: string }> = {};
      allDeals.forEach((d: any) => {
        const cid = d.campaign_id || "none";
        if (!campaignPerf[cid]) campaignPerf[cid] = { revenue: 0, cost: 0, leads: 0, name: d.campaign_name || cid };
        campaignPerf[cid].revenue += Number(d.revenue_generated || 0);
        campaignPerf[cid].cost += Number(d.cost_per_lead || 0);
        campaignPerf[cid].leads++;
      });

      // 4. Budget Allocation Decisions
      const scalingActions: any[] = [];
      const allocations: any[] = [];

      for (const [cid, perf] of Object.entries(campaignPerf)) {
        if (cid === "none") continue;
        const roi = perf.cost > 0 ? ((perf.revenue - perf.cost) / perf.cost) * 100 : 0;

        // SCALE: High ROI campaigns
        if (roi > Number(config.min_roi_to_scale) && config.auto_scale_enabled) {
          const currentBudget = perf.cost;
          const newBudget = Math.min(currentBudget * 1.5, Number(config.max_budget_per_campaign));
          scalingActions.push({
            action_type: "scale_up", target_campaign: perf.name, target_channel: "ads",
            previous_budget: currentBudget, new_budget: newBudget,
            reason: `ROI ${roi.toFixed(0)}% exceeds ${config.min_roi_to_scale}% threshold`,
            roi_at_decision: roi, automated: true,
          });
          allocations.push({ campaign: perf.name, amount: newBudget - currentBudget, action: "increase" });
        }

        // KILL: Negative ROI campaigns
        if (roi < Number(config.stop_loss_threshold) && config.auto_kill_enabled) {
          scalingActions.push({
            action_type: "kill", target_campaign: perf.name, target_channel: "ads",
            previous_budget: perf.cost, new_budget: 0,
            reason: `ROI ${roi.toFixed(0)}% below stop-loss ${config.stop_loss_threshold}%`,
            roi_at_decision: roi, automated: true,
          });
          allocations.push({ campaign: perf.name, amount: -perf.cost, action: "kill" });
        }
      }

      // 5. Insert scaling actions
      if (scalingActions.length > 0) {
        await supabase.from("brandaro_scaling_actions").insert(scalingActions);
      }

      // 6. Reinvestment calculation
      const reinvestmentAmount = totalRevenue * (Number(config.reinvestment_pct) / 100);
      const topChannels = Object.entries(channelPerf)
        .map(([ch, p]) => ({ channel: ch, roi: p.cost > 0 ? ((p.revenue - p.cost) / p.cost) * 100 : 0, ...p }))
        .sort((a, b) => b.roi - a.roi);

      // Distribute reinvestment to top channels proportionally
      const totalTopROI = topChannels.filter(c => c.roi > 0).reduce((s, c) => s + c.roi, 0);
      const reinvestAllocations = topChannels
        .filter(c => c.roi > 0)
        .map(c => ({
          channel: c.channel,
          amount: totalTopROI > 0 ? reinvestmentAmount * (c.roi / totalTopROI) : 0,
          roi: c.roi,
        }));

      // 7. Log reinvestment cycle
      const { data: lastCycle } = await supabase
        .from("brandaro_reinvestment_cycles")
        .select("cycle_number")
        .order("cycle_number", { ascending: false })
        .limit(1);

      const nextCycle = (lastCycle?.[0]?.cycle_number || 0) + 1;

      await supabase.from("brandaro_reinvestment_cycles").insert({
        cycle_number: nextCycle,
        total_revenue: totalRevenue,
        reinvestment_pct: config.reinvestment_pct,
        reinvestment_amount: reinvestmentAmount,
        allocations: reinvestAllocations,
        campaigns_scaled: scalingActions.filter(a => a.action_type === "scale_up").length,
        campaigns_killed: scalingActions.filter(a => a.action_type === "kill").length,
        net_roi: topChannels.length > 0 ? topChannels.reduce((s, c) => s + c.roi, 0) / topChannels.length : 0,
      });

      // 8. Update budget allocations table
      for (const alloc of reinvestAllocations) {
        await supabase.from("brandaro_budget_allocations").upsert({
          channel: alloc.channel,
          allocated_amount: alloc.amount,
          revenue_attributed: channelPerf[alloc.channel]?.revenue || 0,
          roi_pct: alloc.roi,
          status: "active",
          scaling_action: alloc.roi > Number(config.min_roi_to_scale) ? "scaling" : "maintaining",
          updated_at: new Date().toISOString(),
        }, { onConflict: "channel" });
      }

      return new Response(JSON.stringify({
        success: true,
        cycle: nextCycle,
        totalRevenue,
        reinvestmentAmount,
        scalingActions: scalingActions.length,
        channelPerformance: topChannels,
        reinvestAllocations,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: GET DASHBOARD ──
    if (action === "get-dashboard") {
      const [attr, budgets, actions, cycles] = await Promise.all([
        supabase.from("brandaro_revenue_attribution").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("brandaro_budget_allocations").select("*").eq("status", "active"),
        supabase.from("brandaro_scaling_actions").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("brandaro_reinvestment_cycles").select("*").order("cycle_number", { ascending: false }).limit(10),
      ]);

      return new Response(JSON.stringify({
        attributions: attr.data || [],
        budgets: budgets.data || [],
        scalingActions: actions.data || [],
        cycles: cycles.data || [],
        config,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
