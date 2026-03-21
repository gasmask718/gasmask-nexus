import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const targetStoreId = body.store_id; // optional: calculate for single store

    // Fetch all stores (or single)
    let storesQuery = supabase.from("store_master").select("id, store_name");
    if (targetStoreId) storesQuery = storesQuery.eq("id", targetStoreId);
    const { data: stores } = await storesQuery;
    if (!stores?.length) {
      return new Response(JSON.stringify({ success: true, calculated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const storeIds = stores.map((s: any) => s.id);

    // Batch fetch: notes, tubes, checklist visits
    const [notesRes, tubesRes, checklistRes] = await Promise.all([
      supabase.from("store_notes").select("store_id, cleaning_status, note_text").in("store_id", storeIds),
      supabase.from("store_tube_inventory").select("store_id, current_tubes_left").in("store_id", storeIds),
      supabase.from("checklist_tube_intelligence").select("store_id, interest, visit_date, tube_count, status")
        .in("store_id", storeIds),
    ]);

    const notesByStore = groupBy(notesRes.data || [], "store_id");
    const tubesByStore = groupBy(tubesRes.data || [], "store_id");
    const checklistByStore = groupBy(checklistRes.data || [], "store_id");

    const upserts = [];

    for (const store of stores) {
      const notes = notesByStore[store.id] || [];
      const tubes = tubesByStore[store.id] || [];
      const checklist = checklistByStore[store.id] || [];

      // Visit score (25%) - based on recency of checklist visits
      const visitDates = checklist.map((c: any) => c.visit_date).filter(Boolean).sort().reverse();
      const lastVisitDate = visitDates[0] || null;
      const daysSinceVisit = lastVisitDate
        ? Math.floor((Date.now() - new Date(lastVisitDate).getTime()) / 86400000)
        : 999;
      const visitScore = daysSinceVisit <= 7 ? 100 : daysSinceVisit <= 14 ? 80 : daysSinceVisit <= 30 ? 60 : daysSinceVisit <= 60 ? 30 : 0;

      // Tube score (20%) - active products with stock
      const activeProducts = checklist.filter((c: any) => c.status === "active");
      const withStock = activeProducts.filter((c: any) => (c.tube_count || 0) > 0);
      const tubeScore = activeProducts.length > 0 ? Math.round((withStock.length / activeProducts.length) * 100) : 50;

      // Interest score (15%) - ratio of Interested signals
      const interestEntries = checklist.filter((c: any) => c.interest);
      const interested = interestEntries.filter((c: any) => c.interest === "Interested");
      const interestScore = interestEntries.length > 0
        ? Math.round((interested.length / interestEntries.length) * 100)
        : 50;

      // Notes quality (10%) - penalty for dirty/legacy notes
      const dirtyNotes = notes.filter((n: any) => {
        if (n.cleaning_status === "approved") return false;
        const text = n.note_text || "";
        return /<\/?[a-z][\s\S]*?>/i.test(text) || /&amp;|&nbsp;/i.test(text);
      });
      const notesScore = notes.length > 0
        ? Math.round(((notes.length - dirtyNotes.length) / notes.length) * 100)
        : 50;

      // Invoice activity (10%) - placeholder using tube inventory activity
      const totalTubes = tubes.reduce((sum: number, t: any) => sum + (t.current_tubes_left || 0), 0);
      const invoiceScore = totalTubes > 20 ? 100 : totalTubes > 10 ? 75 : totalTubes > 0 ? 50 : 20;

      // Compliance score (20%) - placeholder (no sticker data available, use 50 default)
      const complianceScore = 50;

      // Weighted overall
      const overall = Math.round(
        visitScore * 0.25 +
        complianceScore * 0.20 +
        tubeScore * 0.20 +
        interestScore * 0.15 +
        notesScore * 0.10 +
        invoiceScore * 0.10
      );

      const tier = overall >= 80 ? "Healthy" : overall >= 60 ? "Needs Attention" : overall >= 40 ? "At Risk" : "Critical";

      const recentVisits30d = visitDates.filter((d: string) => new Date(d) >= new Date(thirtyDaysAgo)).length;

      upserts.push({
        store_id: store.id,
        overall_score: overall,
        health_status: tier,
        dimension_scores: { visit: visitScore, compliance: complianceScore, tube: tubeScore, interest: interestScore, notes: notesScore, invoice: invoiceScore },
        dimension_explanations: {
          visit: `${daysSinceVisit} days since last visit`,
          compliance: "Default baseline",
          tube: `${withStock.length}/${activeProducts.length} products in stock`,
          interest: `${interested.length}/${interestEntries.length} interested signals`,
          notes: `${dirtyNotes.length} legacy notes remaining`,
          invoice: `${totalTubes} tubes in inventory`,
        },
        last_visit_date: lastVisitDate,
        total_visits_30d: recentVisits30d,
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Upsert in batches of 100
    let calculated = 0;
    for (let i = 0; i < upserts.length; i += 100) {
      const batch = upserts.slice(i, i + 100);
      const { error } = await supabase.from("store_health_scores").upsert(batch, { onConflict: "store_id" });
      if (error) console.error("Upsert error:", error);
      else calculated += batch.length;
    }

    return new Response(JSON.stringify({ success: true, calculated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Health score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function groupBy(arr: any[], key: string): Record<string, any[]> {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, any[]>);
}
