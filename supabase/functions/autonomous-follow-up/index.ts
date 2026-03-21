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

    const results = { stale_tasks: 0, interest_tasks: 0, zero_stock_alerts: 0 };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const threeDaysFromNow = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];

    // 1. Find stores not visited in 30+ days via checklist
    const { data: recentVisits } = await supabase
      .from("checklist_tube_intelligence")
      .select("store_id, visit_date")
      .gte("visit_date", thirtyDaysAgo)
      .order("visit_date", { ascending: false });

    const recentlyVisitedStoreIds = new Set((recentVisits || []).map((v: any) => v.store_id));

    // Get all stores with health scores
    const { data: allStores } = await supabase
      .from("store_health_scores")
      .select("store_id, overall_score, health_status, last_visit_date")
      .not("store_id", "in", `(${[...recentlyVisitedStoreIds].join(",") || "00000000-0000-0000-0000-000000000000"})`)
      .order("overall_score", { ascending: true })
      .limit(50);

    for (const store of allStores || []) {
      // Check if task already exists for this store
      const { data: existingTask } = await supabase
        .from("ai_work_tasks")
        .select("id")
        .eq("input_data->>store_id", store.store_id)
        .eq("status", "pending")
        .eq("task_type", "follow_up_visit")
        .limit(1);

      if (existingTask?.length) continue;

      // Get store name
      const { data: storeInfo } = await supabase
        .from("store_master")
        .select("store_name")
        .eq("id", store.store_id)
        .single();

      const storeName = storeInfo?.store_name || "Unknown Store";

      await supabase.from("ai_work_tasks").insert({
        task_title: `Visit overdue — ${storeName}`,
        task_details: `No visit in 30+ days. Health score: ${store.overall_score}. Schedule a visit.`,
        status: "pending",
        priority: store.overall_score < 40 ? "critical" : "high",
        task_type: "follow_up_visit",
        department: "field_ops",
        input_data: { store_id: store.store_id, store_name: storeName, health_score: store.overall_score },
      });

      await supabase.from("ai_instinct_log").insert({
        action_type: "task_created",
        reasoning: `Store "${storeName}" not visited in 30+ days. Health score: ${store.overall_score}. Created follow-up task.`,
        input_data: { store_id: store.store_id, last_visit: store.last_visit_date },
        decision_path: { agent: "Follow-Up Engine", action: "create_visit_task" },
        confidence_score: 0.9,
      });

      results.stale_tasks++;
    }

    // 2. Find stores with "Interested" signals but no follow-up task
    const { data: interestedStores } = await supabase
      .from("checklist_tube_intelligence")
      .select("store_id, product_name, interest, visit_date")
      .eq("interest", "Interested")
      .gte("visit_date", new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0]);

    const uniqueInterestedStores = [...new Set((interestedStores || []).map((s: any) => s.store_id))];

    for (const storeId of uniqueInterestedStores) {
      const { data: existing } = await supabase
        .from("ai_work_tasks")
        .select("id")
        .eq("input_data->>store_id", storeId)
        .eq("status", "pending")
        .eq("task_type", "interest_follow_up")
        .limit(1);

      if (existing?.length) continue;

      const products = (interestedStores || [])
        .filter((s: any) => s.store_id === storeId)
        .map((s: any) => s.product_name);

      const { data: storeInfo } = await supabase
        .from("store_master")
        .select("store_name")
        .eq("id", storeId)
        .single();

      await supabase.from("ai_work_tasks").insert({
        task_title: `Follow up interest — ${storeInfo?.store_name || "Store"}`,
        task_details: `Store expressed interest in: ${products.join(", ")}. Follow up to close.`,
        status: "pending",
        priority: "high",
        task_type: "interest_follow_up",
        department: "sales",
        input_data: { store_id: storeId, products, store_name: storeInfo?.store_name },
      });

      results.interest_tasks++;
    }

    // 3. Find zero-stock products and create alerts
    const { data: zeroStock } = await supabase
      .from("checklist_tube_intelligence")
      .select("store_id, product_name")
      .eq("status", "active")
      .eq("tube_count", 0);

    // Group by store
    const zeroByStore: Record<string, string[]> = {};
    for (const item of zeroStock || []) {
      if (!zeroByStore[item.store_id]) zeroByStore[item.store_id] = [];
      zeroByStore[item.store_id].push(item.product_name);
    }

    for (const [storeId, products] of Object.entries(zeroByStore)) {
      if (products.length < 2) continue; // Only alert if 2+ products at zero

      const { data: existing } = await supabase
        .from("ai_drift_alerts")
        .select("id")
        .eq("alert_type", "zero_stock")
        .eq("metadata->>store_id", storeId)
        .eq("status", "open")
        .limit(1);

      if (existing?.length) continue;

      const { data: storeInfo } = await supabase.from("store_master").select("store_name").eq("id", storeId).single();

      await supabase.from("ai_drift_alerts").insert({
        alert_type: "zero_stock",
        severity: "warning",
        message: `${storeInfo?.store_name || "Store"}: ${products.length} products at zero stock (${products.join(", ")})`,
        status: "open",
        metadata: { store_id: storeId, products },
      });

      results.zero_stock_alerts++;
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Follow-up engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
