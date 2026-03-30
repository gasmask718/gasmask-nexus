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

    // 1. Get unassigned leads for the language
    const { data: unassigned, error: leadsErr } = await supabase
      .from("brandaro_leads_master")
      .select("id, language, region, intent_score")
      .is("assigned_va_id", null)
      .eq("language", language)
      .order("intent_score", { ascending: false })
      .limit(100);

    if (leadsErr) throw leadsErr;
    if (!unassigned || unassigned.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unassigned leads", distributed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get active VAs in the team hierarchy for this language
    const { data: teamMembers, error: teamErr } = await supabase
      .from("brandaro_team_hierarchy")
      .select("va_id, manager_id")
      .eq("status", "active");

    if (teamErr) throw teamErr;

    const vaIds = (teamMembers || []).map((t: any) => t.va_id);
    if (vaIds.length === 0) {
      // Fallback: assign to managers directly
      const { data: managers } = await supabase
        .from("brandaro_team_hierarchy")
        .select("manager_id")
        .eq("status", "active");

      const managerIds = [...new Set((managers || []).map((m: any) => m.manager_id))];
      if (managerIds.length === 0) {
        return new Response(
          JSON.stringify({ message: "No VAs or managers available", distributed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Get current workload per VA
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

    // 4. Get VA performance (closes)
    const { data: perfData } = await supabase
      .from("brandaro_va_performance")
      .select("va_id, total_closes, total_calls")
      .in("va_id", vaIds);

    const perfMap: Record<string, number> = {};
    (perfData || []).forEach((p: any) => {
      // Performance score: closes weighted heavily
      perfMap[p.va_id] = (p.total_closes || 0) * 10 + (p.total_calls || 0);
    });

    // 5. Smart distribution: best performers get more, respect max_per_va
    const sortedVAs = vaIds
      .filter((id: string) => (loadMap[id] || 0) < max_per_va)
      .sort((a: string, b: string) => {
        // Higher performance + lower load = higher priority
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

    // 6. Round-robin distribute with performance weighting
    const distributions: any[] = [];
    let vaIndex = 0;

    for (const lead of unassigned) {
      const vaId = sortedVAs[vaIndex % sortedVAs.length];
      
      // Check capacity
      if ((loadMap[vaId] || 0) >= max_per_va) {
        vaIndex++;
        if (vaIndex >= sortedVAs.length) break;
        continue;
      }

      // Assign lead
      const { error: updateErr } = await supabase
        .from("brandaro_leads_master")
        .update({ assigned_va_id: vaId })
        .eq("id", lead.id);

      if (!updateErr) {
        // Log distribution
        await supabase.from("brandaro_lead_distributions").insert({
          lead_id: lead.id,
          assigned_to: vaId,
          assigned_by: "auto_distribution",
          distribution_reason: `Smart balance: perf=${perfMap[vaId] || 0}, load=${loadMap[vaId] || 0}`,
        });

        loadMap[vaId] = (loadMap[vaId] || 0) + 1;
        distributions.push({ lead_id: lead.id, va_id: vaId });
      }

      vaIndex++;
    }

    return new Response(
      JSON.stringify({
        distributed: distributions.length,
        total_unassigned: unassigned.length,
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
