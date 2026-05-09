// tube-replenishment-ai
// Tube-specific replenishment recommendations sourced from the canonical
// v_invoice_effective_tubes view (NOT wholesale_orders). Used by the
// dialer's "Schedule Delivery" flow to pre-fill accurate box quantities.
//
// Cloned from supabase/functions/replenishment-ai/index.ts (Session 7, Step 3).

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TUBES_PER_BOX = 100;
const RETAIL_PRICE_PER_BOX = 200;
const WHOLESALE_PRICE_PER_BOX = 150;

interface BrandAgg {
  brand: string;
  lifetime_tubes: number;
  invoice_count: number;
  last_order_date: string | null;
  avg_tubes_per_order: number;
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

    // Pull store tube summary (canonical)
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
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull per-invoice tube counts joined with invoice brand for this store.
    // v_invoice_effective_tubes lacks brand, so we join via invoices.
    const { data: invoiceRows, error: invErr } = await supabase
      .from("invoices")
      .select("id, brand, created_at")
      .eq("store_id", storeId)
      .is("deleted_at", null);
    if (invErr) throw invErr;

    const invoiceIds = (invoiceRows ?? []).map((r: any) => r.id);
    let tubeRows: any[] = [];
    if (invoiceIds.length > 0) {
      const { data: vRows, error: vErr } = await supabase
        .from("v_invoice_effective_tubes")
        .select("invoice_id, tube_count, invoice_date")
        .in("invoice_id", invoiceIds);
      if (vErr) throw vErr;
      tubeRows = vRows ?? [];
    }

    // Index brand by invoice_id
    const brandByInvoice = new Map<string, string>();
    for (const r of invoiceRows ?? []) {
      if (r?.id) brandByInvoice.set(r.id, (r.brand || "Unknown").toString());
    }

    // Aggregate per brand
    const agg = new Map<string, BrandAgg>();
    for (const tr of tubeRows) {
      const brand = brandByInvoice.get(tr.invoice_id) || "Unknown";
      const tubes = Number(tr.tube_count) || 0;
      const dateStr = tr.invoice_date as string | null;
      const cur = agg.get(brand) ?? {
        brand,
        lifetime_tubes: 0,
        invoice_count: 0,
        last_order_date: null,
        avg_tubes_per_order: 0,
      };
      cur.lifetime_tubes += tubes;
      cur.invoice_count += 1;
      if (
        dateStr &&
        (!cur.last_order_date ||
          new Date(dateStr) > new Date(cur.last_order_date))
      ) {
        cur.last_order_date = dateStr;
      }
      agg.set(brand, cur);
    }
    for (const v of agg.values()) {
      v.avg_tubes_per_order = v.invoice_count
        ? v.lifetime_tubes / v.invoice_count
        : 0;
    }

    const now = Date.now();
    const lastTxn = summary.last_tube_transaction_at
      ? new Date(summary.last_tube_transaction_at).getTime()
      : null;
    const lastOrderDaysAgo = lastTxn
      ? Math.floor((now - lastTxn) / 86_400_000)
      : null;

    // Monthly velocity in boxes (last 30d preferred; fallback to 90d/3)
    const tubes30 = Number(summary.tubes_last_30_days) || 0;
    const tubes90 = Number(summary.tubes_last_90_days) || 0;
    const monthlyTubes = tubes30 > 0 ? tubes30 : tubes90 / 3;
    const monthlyVelocityBoxes = +(monthlyTubes / TUBES_PER_BOX).toFixed(2);

    // Wholesale heuristic
    const lifetimeRevenue = Number(summary.lifetime_invoice_revenue) || 0;
    const invCount = Number(summary.invoice_count) || 0;
    const avgInvoice = invCount ? lifetimeRevenue / invCount : 0;
    const isWholesale =
      /wholesale/i.test(summary.store_name ?? "") || avgInvoice > 1000;
    const pricePerBox = isWholesale
      ? WHOLESALE_PRICE_PER_BOX
      : RETAIL_PRICE_PER_BOX;

    const inventoryCount = Number(summary.current_inventory_count) || 0;

    // Build recommendations: math-driven quantities
    const ranked = Array.from(agg.values()).sort(
      (a, b) => b.lifetime_tubes - a.lifetime_tubes,
    );

    const recommendations = ranked.map((b) => {
      const avgBoxes = Math.max(1, Math.round(b.avg_tubes_per_order / TUBES_PER_BOX));
      // Subtract on-hand inventory only if recent + meaningful
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

      const reason =
        timing === "urgent"
          ? `Last ${b.brand} order was ${brandLastDays} days ago. Historical avg ${avgBoxes} boxes per delivery — overdue restock.`
          : timing === "soon"
          ? `${b.brand} typically reorders every ~30 days. ${brandLastDays} days since last — pitch ${recommendedBoxes} boxes.`
          : `${b.brand} on regular cadence (${brandLastDays}d). Maintain ${recommendedBoxes}-box delivery.`;

      return {
        brand: b.brand,
        recommended_boxes: recommendedBoxes,
        recommended_tubes: recommendedBoxes * TUBES_PER_BOX,
        estimated_revenue: recommendedBoxes * pricePerBox,
        stockout_risk_score: risk,
        reason,
        recommended_timing: timing,
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
      },
    };

    console.log(
      `[tube-replenishment-ai] ${recommendations.length} recs for ${summary.store_name}`,
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
