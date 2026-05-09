// tube-replenishment-ai
// Tube-specific replenishment recommendations sourced from the canonical
// v_invoice_effective_tubes view (NOT wholesale_orders).
//
// Session 7, Step 3.5:
//   PART A — Visit-day grouping (avg tubes per distinct visit day, not per
//            invoice row, with 1.3x safety factor).
//   PART B — Price-cluster verification: cross-checks each invoice's implied
//            $/tube against legacy_invoice_price_map and emits a confidence
//            rating that the UI can surface to the operator.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TUBES_PER_BOX = 100;
const SAFETY_FACTOR = 1.3;
const RETAIL_PRICE_PER_BOX = 200;
const WHOLESALE_PRICE_PER_BOX = 150;
const PRICE_TOLERANCE = 0.10; // $/tube tolerance for cluster match

interface BrandAgg {
  brand: string;
  lifetime_tubes: number;
  visit_days: Set<string>;
  invoice_count: number;
  last_order_date: string | null;
  tubes_by_day: Map<string, number>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const { storeId } = await req.json();
    if (!storeId) throw new Error("storeId is required");

    console.log("[tube-replenishment-ai] storeId:", storeId);

    // Canonical store summary
    const { data: summary, error: sumErr } = await supabase
      .from("v_store_tube_summary")
      .select(
        "store_id, store_name, lifetime_tubes_sold, tubes_last_30_days, tubes_last_90_days, current_inventory_count, top_brand, last_tube_transaction_at, invoice_count, lifetime_invoice_revenue",
      )
      .eq("store_id", storeId)
      .maybeSingle();
    if (sumErr) throw sumErr;
    if (!summary) {
      return new Response(
        JSON.stringify({
          store_id: storeId,
          store_name: null,
          recommendations: [],
          analysis: {
            lifetime_tubes_sold: 0,
            last_order_days_ago: null,
            monthly_velocity_boxes: 0,
            total_invoices: 0,
            is_wholesale: false,
            price_verification: {
              invoices_with_verified_pricing: 0,
              invoices_with_inferred_pricing: 0,
              invoices_with_unclear_pricing: 0,
              price_clusters_used: [],
              verification_confidence: "low",
            },
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull invoices for this store
    const { data: invoiceRows, error: invErr } = await supabase
      .from("invoices")
      .select("id, brand, total, created_at")
      .eq("store_id", storeId)
      .is("deleted_at", null);
    if (invErr) throw invErr;

    const invoiceIds = (invoiceRows ?? []).map((r: any) => r.id);

    // Pull tube view rows
    let tubeRows: any[] = [];
    if (invoiceIds.length > 0) {
      const { data: vRows, error: vErr } = await supabase
        .from("v_invoice_effective_tubes")
        .select("invoice_id, tube_count, invoice_date")
        .in("invoice_id", invoiceIds);
      if (vErr) throw vErr;
      tubeRows = vRows ?? [];
    }

    // Pull price-cluster map (small reference table)
    const { data: clusterRows } = await supabase
      .from("legacy_invoice_price_map")
      .select("total_amount, price_per_unit, inferred_units, confidence_level");
    const clusterByTotal = new Map<number, any>();
    for (const c of clusterRows ?? []) {
      clusterByTotal.set(Number(c.total_amount), c);
    }

    // Index invoice meta + tube counts
    const invoiceMeta = new Map<string, { brand: string; total: number; date: string | null }>();
    for (const r of invoiceRows ?? []) {
      invoiceMeta.set(r.id, {
        brand: (r.brand || "Unknown").toString(),
        total: Number(r.total) || 0,
        date: r.created_at ? String(r.created_at).slice(0, 10) : null,
      });
    }
    const tubesByInvoice = new Map<string, number>();
    for (const tr of tubeRows) {
      tubesByInvoice.set(tr.invoice_id, Number(tr.tube_count) || 0);
    }

    // ========== PART B: Price-cluster verification ==========
    let verifiedCnt = 0;
    let inferredCnt = 0;
    let unclearCnt = 0;
    const clusterUsage = new Map<number, number>(); // ppt → count

    for (const inv of invoiceRows ?? []) {
      const tubes = tubesByInvoice.get(inv.id);
      const total = Number(inv.total) || 0;
      if (!tubes || tubes <= 0) {
        unclearCnt++;
        continue;
      }
      const impliedPpt = total / tubes;
      const cluster = clusterByTotal.get(total);
      if (
        cluster &&
        Math.abs(Number(cluster.price_per_unit) - impliedPpt) < PRICE_TOLERANCE
      ) {
        verifiedCnt++;
        const ppt = Math.round(Number(cluster.price_per_unit) * 100) / 100;
        clusterUsage.set(ppt, (clusterUsage.get(ppt) ?? 0) + 1);
      } else {
        inferredCnt++;
        const ppt = Math.round(impliedPpt * 100) / 100;
        clusterUsage.set(ppt, (clusterUsage.get(ppt) ?? 0) + 1);
      }
    }
    const totalEvaluated = verifiedCnt + inferredCnt + unclearCnt;
    const verifiedPct = totalEvaluated ? verifiedCnt / totalEvaluated : 0;
    const verificationConfidence: "high" | "medium" | "low" =
      verifiedPct >= 0.8 ? "high" : verifiedPct >= 0.5 ? "medium" : "low";
    const priceClustersUsed = Array.from(clusterUsage.entries())
      .map(([price_per_tube, invoice_count]) => ({ price_per_tube, invoice_count }))
      .sort((a, b) => b.invoice_count - a.invoice_count);

    // ========== PART A: Visit-day grouping per brand ==========
    const agg = new Map<string, BrandAgg>();
    for (const tr of tubeRows) {
      const meta = invoiceMeta.get(tr.invoice_id);
      const brand = meta?.brand || "Unknown";
      const tubes = Number(tr.tube_count) || 0;
      const dayKey = (tr.invoice_date || meta?.date || "").slice(0, 10);
      if (!dayKey) continue;
      const cur = agg.get(brand) ?? {
        brand,
        lifetime_tubes: 0,
        visit_days: new Set<string>(),
        invoice_count: 0,
        last_order_date: null,
        tubes_by_day: new Map<string, number>(),
      };
      cur.lifetime_tubes += tubes;
      cur.invoice_count += 1;
      cur.visit_days.add(dayKey);
      cur.tubes_by_day.set(dayKey, (cur.tubes_by_day.get(dayKey) ?? 0) + tubes);
      if (!cur.last_order_date || dayKey > cur.last_order_date) {
        cur.last_order_date = dayKey;
      }
      agg.set(brand, cur);
    }

    const now = Date.now();
    const lastTxn = summary.last_tube_transaction_at
      ? new Date(summary.last_tube_transaction_at).getTime()
      : null;
    const lastOrderDaysAgo = lastTxn
      ? Math.floor((now - lastTxn) / 86_400_000)
      : null;

    const tubes30 = Number(summary.tubes_last_30_days) || 0;
    const tubes90 = Number(summary.tubes_last_90_days) || 0;
    const monthlyTubes = tubes30 > 0 ? tubes30 : tubes90 / 3;
    const monthlyVelocityBoxes = +(monthlyTubes / TUBES_PER_BOX).toFixed(2);

    const lifetimeRevenue = Number(summary.lifetime_invoice_revenue) || 0;
    const invCount = Number(summary.invoice_count) || 0;
    const avgInvoice = invCount ? lifetimeRevenue / invCount : 0;
    const isWholesale =
      /wholesale/i.test(summary.store_name ?? "") || avgInvoice > 1000;
    const pricePerBox = isWholesale
      ? WHOLESALE_PRICE_PER_BOX
      : RETAIL_PRICE_PER_BOX;

    const inventoryCount = Number(summary.current_inventory_count) || 0;

    const ranked = Array.from(agg.values()).sort(
      (a, b) => b.lifetime_tubes - a.lifetime_tubes,
    );

    const recommendations = ranked.map((b) => {
      const visitDays = b.visit_days.size || 1;
      const avgTubesPerVisit = b.lifetime_tubes / visitDays;
      const recBoxesRaw = (avgTubesPerVisit * SAFETY_FACTOR) / TUBES_PER_BOX;
      const avgBoxes = Math.max(1, Math.round(recBoxesRaw));

      const inventoryAdj =
        inventoryCount > 0 && lastOrderDaysAgo !== null && lastOrderDaysAgo < 30
          ? Math.floor(inventoryCount / TUBES_PER_BOX)
          : 0;
      const recommendedBoxes = Math.max(1, avgBoxes - inventoryAdj);

      const brandLastDays = b.last_order_date
        ? Math.floor((now - new Date(b.last_order_date).getTime()) / 86_400_000)
        : lastOrderDaysAgo ?? 999;

      let timing: "urgent" | "soon" | "routine";
      let risk: number;
      if (brandLastDays > 90) {
        timing = "urgent";
        risk = Math.min(100, 70 + Math.min(30, brandLastDays - 90));
      } else if (brandLastDays >= 30) {
        timing = "soon";
        risk = 40 + Math.round(((brandLastDays - 30) / 60) * 30);
      } else {
        timing = "routine";
        risk = Math.max(10, 30 - brandLastDays);
      }

      const avgVisitTubes = Math.round(avgTubesPerVisit);
      const reason =
        timing === "urgent"
          ? `Last ${b.brand} delivery was ${brandLastDays} days ago. Across ${visitDays} visit days, store averages ${avgVisitTubes} tubes/visit (≈${avgBoxes} boxes). Overdue restock.`
          : timing === "soon"
          ? `${b.brand} typically reorders every ~30 days. ${brandLastDays} days since last visit. Avg ${avgVisitTubes} tubes/visit across ${visitDays} visit days → pitch ${recommendedBoxes} boxes.`
          : `${b.brand} on regular cadence (${brandLastDays}d). Avg ${avgVisitTubes} tubes/visit (${visitDays} visit days) → maintain ${recommendedBoxes}-box delivery.`;

      return {
        brand: b.brand,
        recommended_boxes: recommendedBoxes,
        recommended_tubes: recommendedBoxes * TUBES_PER_BOX,
        estimated_revenue: recommendedBoxes * pricePerBox,
        stockout_risk_score: risk,
        recommended_timing: timing,
        reason,
        debug: {
          visit_days: visitDays,
          avg_tubes_per_visit: avgVisitTubes,
          safety_factor: SAFETY_FACTOR,
          lifetime_tubes: b.lifetime_tubes,
          invoice_rows: b.invoice_count,
        },
      };
    });

    const payload = {
      store_id: storeId,
      store_name: summary.store_name,
      recommendations,
      analysis: {
        lifetime_tubes_sold: Number(summary.lifetime_tubes_sold) || 0,
        last_order_days_ago: lastOrderDaysAgo,
        monthly_velocity_boxes: monthlyVelocityBoxes,
        total_invoices: invCount,
        is_wholesale: isWholesale,
        price_verification: {
          invoices_with_verified_pricing: verifiedCnt,
          invoices_with_inferred_pricing: inferredCnt,
          invoices_with_unclear_pricing: unclearCnt,
          price_clusters_used: priceClustersUsed,
          verification_confidence: verificationConfidence,
          verified_pct: +(verifiedPct * 100).toFixed(1),
        },
      },
    };

    console.log(
      `[tube-replenishment-ai] ${recommendations.length} recs for ${summary.store_name} | confidence=${verificationConfidence} (${verifiedCnt}/${totalEvaluated})`,
    );

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[tube-replenishment-ai] error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
