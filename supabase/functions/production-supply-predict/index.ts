import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { officeId } = await req.json();
    if (!officeId) throw new Error("officeId is required");

    console.log("Running supply prediction for office:", officeId);

    // 1. Get current raw material stock levels
    const { data: materials, error: matErr } = await supabase
      .from("production_raw_materials")
      .select("material_type, quantity, unit, received_at")
      .eq("office_id", officeId)
      .order("received_at", { ascending: true });

    if (matErr) throw matErr;

    // 2. Get recent batch outputs to compute consumption velocity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: batches, error: batchErr } = await supabase
      .from("production_batches")
      .select("id, created_at, tobacco_lbs, tubes_issued, boxes_produced, brand")
      .eq("office_id", officeId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    if (batchErr) throw batchErr;

    // 3. Get supplier lead times
    const { data: leadTimes, error: ltErr } = await supabase
      .from("production_supplier_lead_times")
      .select("*")
      .eq("office_id", officeId);

    if (ltErr) throw ltErr;

    // 4. Aggregate current stock by material_type
    const stockByType: Record<string, number> = {};
    for (const m of materials || []) {
      stockByType[m.material_type] = (stockByType[m.material_type] || 0) + Number(m.quantity || 0);
    }

    // 5. Compute daily consumption rates from batch data
    const consumptionByType: Record<string, number> = {
      tobacco: 0,
      tubes: 0,
      stickers: 0,
      bags: 0,
      boxes: 0,
    };

    const totalBatches = batches?.length || 0;
    const activeDays = totalBatches > 0
      ? Math.max(1, Math.ceil(
          (Date.now() - new Date(batches![0].created_at).getTime()) / (1000 * 60 * 60 * 24)
        ))
      : 30;

    for (const b of batches || []) {
      consumptionByType.tobacco += Number(b.tobacco_lbs || 0);
      consumptionByType.tubes += Number(b.tubes_issued || 0);
      // Estimate: 1 sticker per box, 1 bag per box, 1 box per box
      const boxes = Number(b.boxes_produced || 0);
      consumptionByType.stickers += boxes;
      consumptionByType.bags += boxes;
      consumptionByType.boxes += boxes;
    }

    // Convert to daily rates
    for (const key of Object.keys(consumptionByType)) {
      consumptionByType[key] = consumptionByType[key] / activeDays;
    }

    // 6. Build lead time map
    const leadTimeMap: Record<string, { days: number; supplier: string; reliability: number }> = {};
    for (const lt of leadTimes || []) {
      leadTimeMap[lt.material_type] = {
        days: lt.lead_time_days || 3,
        supplier: lt.supplier_name || "Unknown",
        reliability: Number(lt.reliability_score || 80),
      };
    }

    // 7. Build context for AI reasoning
    const materialSummaries = Object.keys(consumptionByType).map((type) => {
      const currentStock = stockByType[type] || 0;
      const dailyRate = consumptionByType[type];
      const daysOfStock = dailyRate > 0 ? Math.floor(currentStock / dailyRate) : 999;
      const lt = leadTimeMap[type] || { days: 3, supplier: "Unknown", reliability: 80 };

      return {
        material_type: type,
        current_stock: Math.round(currentStock * 100) / 100,
        daily_consumption_rate: Math.round(dailyRate * 100) / 100,
        days_of_stock_remaining: daysOfStock,
        lead_time_days: lt.days,
        supplier: lt.supplier,
        supplier_reliability: lt.reliability,
      };
    });

    // 8. Call Lovable AI for explainable predictions
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiReasonings: Record<string, string> = {};

    if (LOVABLE_API_KEY) {
      try {
        const aiPrompt = `You are a supply chain analyst for a manufacturing operation that produces tobacco products (tubes → boxes).

Analyze these material stock levels and consumption rates. For each material, provide a 1-2 sentence prediction explaining the reorder urgency and reasoning.

Materials data:
${JSON.stringify(materialSummaries, null, 2)}

Context:
- Data covers the last ${activeDays} production days with ${totalBatches} batches
- Lead times vary by supplier
- Production runs 5-6 days per week

Respond with a JSON object where keys are material types and values are the reasoning strings.
Example: {"tobacco": "Current stock covers ~15 days. With a 5-day lead time, reorder by March 15 to maintain safety buffer.", "tubes": "..."}`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a supply chain prediction engine. Return ONLY valid JSON. No markdown, no code fences." },
              { role: "user", content: aiPrompt },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          // Parse JSON from response, stripping any code fences
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          try {
            aiReasonings = JSON.parse(cleaned);
          } catch {
            console.warn("Failed to parse AI reasoning, using fallback");
          }
        } else {
          console.warn("AI gateway returned:", aiResponse.status);
        }
      } catch (aiErr) {
        console.warn("AI reasoning failed, using deterministic fallback:", aiErr);
      }
    }

    // 9. Generate predictions
    const predictions = materialSummaries.map((ms) => {
      const daysRemaining = ms.days_of_stock_remaining;
      const leadDays = ms.lead_time_days;
      const safetyBuffer = Math.ceil(leadDays * 0.5); // 50% buffer

      const stockoutDate = new Date();
      stockoutDate.setDate(stockoutDate.getDate() + daysRemaining);

      const reorderDate = new Date();
      reorderDate.setDate(reorderDate.getDate() + Math.max(0, daysRemaining - leadDays - safetyBuffer));

      // Calculate recommended order qty (2 weeks of consumption)
      const recommendedQty = Math.ceil(ms.daily_consumption_rate * 14);

      // Determine urgency
      let urgency: "critical" | "warning" | "normal" | "surplus" = "normal";
      if (daysRemaining <= leadDays) urgency = "critical";
      else if (daysRemaining <= leadDays + safetyBuffer + 3) urgency = "warning";
      else if (daysRemaining > 60) urgency = "surplus";

      // Confidence: higher with more data points
      const confidence = Math.min(95, 40 + totalBatches * 2);

      const fallbackReasoning = daysRemaining > 60
        ? `Surplus stock — ${daysRemaining} days remaining at current consumption rate. No action needed.`
        : daysRemaining <= leadDays
        ? `CRITICAL: Only ${daysRemaining} days of stock remaining, but supplier lead time is ${leadDays} days. Immediate reorder required.`
        : `Stock covers ${daysRemaining} days. With ${leadDays}-day lead time, recommend reordering by ${reorderDate.toISOString().split("T")[0]}.`;

      return {
        office_id: officeId,
        material_type: ms.material_type,
        current_stock: ms.current_stock,
        daily_consumption_rate: ms.daily_consumption_rate,
        predicted_stockout_date: daysRemaining < 999 ? stockoutDate.toISOString().split("T")[0] : null,
        recommended_reorder_date: daysRemaining < 60 ? reorderDate.toISOString().split("T")[0] : null,
        recommended_order_quantity: recommendedQty > 0 ? recommendedQty : null,
        confidence_score: confidence,
        urgency,
        ai_reasoning: aiReasonings[ms.material_type] || fallbackReasoning,
        data_points_used: totalBatches,
        predicted_at: new Date().toISOString(),
      };
    });

    // 10. Upsert predictions (delete old ones for this office, insert new)
    await supabase
      .from("production_supply_predictions")
      .delete()
      .eq("office_id", officeId);

    if (predictions.length > 0) {
      const { error: insertErr } = await supabase
        .from("production_supply_predictions")
        .insert(predictions);
      if (insertErr) throw insertErr;
    }

    console.log(`Generated ${predictions.length} supply predictions for office ${officeId}`);

    return new Response(
      JSON.stringify({
        success: true,
        predictions,
        analysis: {
          active_production_days: activeDays,
          total_batches_analyzed: totalBatches,
          materials_tracked: predictions.length,
          critical_count: predictions.filter((p) => p.urgency === "critical").length,
          warning_count: predictions.filter((p) => p.urgency === "warning").length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Supply prediction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
