import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const { language = "spanish", max_per_va = 20 } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Release expired locks first
    const now = new Date().toISOString();
    await supabase
      .from("brandaro_leads_master")
      .update({ assigned_va_id: null, assigned_locked_until: null, lock_assigned_by: null })
      .lt("assigned_locked_until", now)
      .not("assigned_locked_until", "is", null)
      .in("status", ["new"]);

    // 2. Get unassigned leads SORTED BY PRIORITY: hot first, then warm, then cold
    const { data: unassigned, error: leadsErr } = await supabase
      .from("brandaro_leads_master")
      .select("id, language, region, intent_score, priority_tier")
      .is("assigned_va_id", null)
      .eq("language", language)
      .order("intent_score", { ascending: false })
      .limit(200);

    if (leadsErr) throw leadsErr;
    if (!unassigned || unassigned.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unassigned leads", distributed: 0, by_tier: { hot: 0, warm: 0, cold: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get active VAs
    const { data: teamMembers, error: teamErr } = await supabase
      .from("brandaro_team_hierarchy")
      .select("va_id, manager_id")
      .eq("status", "active");

    if (teamErr) throw teamErr;
    const vaIds = (teamMembers || []).map((t: any) => t.va_id);

    if (vaIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No VAs available", distributed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get current workload per VA
    const { data: currentLoads } = await supabase
      .from("brandaro_leads_master")
      .select("assigned_va_id")
      .in("assigned_va_id", vaIds)
      .in("status", ["new", "contacted", "interested", "ai_warmed"]);

    const loadMap: Record<string, number> = {};
    vaIds.forEach((id: string) => (loadMap[id] = 0));
    (currentLoads || []).forEach((l: any) => {
      if (l.assigned_va_id) loadMap[l.assigned_va_id] = (loadMap[l.assigned_va_id] || 0) + 1;
    });

    // 5. Get VA performance
    const { data: perfData } = await supabase
      .from("brandaro_va_performance")
      .select("va_id, total_closes, total_calls")
      .in("va_id", vaIds);

    const perfMap: Record<string, number> = {};
    (perfData || []).forEach((p: any) => {
      perfMap[p.va_id] = (p.total_closes || 0) * 10 + (p.total_calls || 0);
    });

    // 6. Sort VAs: best performers with lowest load first
    const sortedVAs = vaIds
      .filter((id: string) => (loadMap[id] || 0) < max_per_va)
      .sort((a: string, b: string) => {
        const scoreA = (perfMap[a] || 0) - (loadMap[a] || 0) * 2;
        const scoreB = (perfMap[b] || 0) - (loadMap[b] || 0) * 2;
        return scoreB - scoreA;
      });

    if (sortedVAs.length === 0) {
      return new Response(
        JSON.stringify({ message: "All VAs at max capacity", distributed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Priority distribution: HOT → best VA, WARM → round-robin, COLD → last
    const distributions: any[] = [];
    const tierCounts = { hot: 0, warm: 0, cold: 0 };
    let vaIndex = 0;
    const lockDuration = 2 * 60 * 60 * 1000; // 2 hours

    for (const lead of unassigned) {
      const tier = (lead.priority_tier || "cold") as keyof typeof tierCounts;

      // HOT leads go to best-performing VA (first in sorted list)
      let targetVaIndex = tier === "hot" ? 0 : vaIndex % sortedVAs.length;
      const vaId = sortedVAs[targetVaIndex];

      if (!vaId || (loadMap[vaId] || 0) >= max_per_va) {
        vaIndex++;
        if (vaIndex >= sortedVAs.length * 2) break;
        continue;
      }

      const lockUntil = new Date(Date.now() + lockDuration).toISOString();

      const { error: updateErr } = await supabase
        .from("brandaro_leads_master")
        .update({
          assigned_va_id: vaId,
          assigned_locked_until: lockUntil,
          lock_assigned_by: "auto_distribution",
        })
        .eq("id", lead.id);

      if (!updateErr) {
        await supabase.from("brandaro_lead_distributions").insert({
          lead_id: lead.id,
          assigned_to: vaId,
          assigned_by: "auto_distribution",
          distribution_reason: `Priority: ${tier.toUpperCase()} | Score: ${lead.intent_score} | Perf: ${perfMap[vaId] || 0} | Load: ${loadMap[vaId] || 0}`,
        });

        loadMap[vaId] = (loadMap[vaId] || 0) + 1;
        tierCounts[tier]++;
        distributions.push({ lead_id: lead.id, va_id: vaId, tier });
      }

      if (tier !== "hot") vaIndex++;
    }

    return new Response(
      JSON.stringify({
        distributed: distributions.length,
        total_unassigned: unassigned.length,
        by_tier: tierCounts,
        distributions,
        va_loads: loadMap,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-distribute error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
