import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRABBA_BRANDS = ['gasmask', 'hotmama', 'scalati', 'grabba'] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Generating Grabba Intelligence Report...");

    // Fetch all required data in parallel
    const [
      storesRes,
      ordersRes,
      paymentsRes,
      driversRes,
      ambassadorsRes,
      inventoryRes,
    ] = await Promise.all([
      supabase.from("stores").select("id, name, neighborhood").limit(500),
      supabase.from("wholesale_orders").select("*").in("brand", [...GRABBA_BRANDS]).order("created_at", { ascending: false }).limit(1000),
      supabase.from("store_payments").select("*").limit(500),
      supabase.from("grabba_drivers").select("*"),
      supabase.from("ambassadors").select("*, profiles(full_name)").eq("is_active", true),
      supabase.from("store_tube_inventory").select("*").in("brand", [...GRABBA_BRANDS]),
    ]);

    const stores = storesRes.data || [];
    const orders = ordersRes.data || [];
    const payments = paymentsRes.data || [];
    const drivers = driversRes.data || [];
    const ambassadors = ambassadorsRes.data || [];
    const inventory = inventoryRes.data || [];

    // ═══════════════════════════════════════════════════════════════════════════════
    // BRAND PERFORMANCE
    // ═══════════════════════════════════════════════════════════════════════════════
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const brandPerformance = GRABBA_BRANDS.map(brand => {
      const brandOrders = orders.filter((o: any) => o.brand === brand);
      
      const thisWeek = brandOrders
        .filter((o: any) => new Date(o.created_at) >= oneWeekAgo)
        .reduce((sum: number, o: any) => sum + (o.quantity || 0), 0);
      
      const lastWeek = brandOrders
        .filter((o: any) => {
          const d = new Date(o.created_at);
          return d >= twoWeeksAgo && d < oneWeekAgo;
        })
        .reduce((sum: number, o: any) => sum + (o.quantity || 0), 0);

      const growthRate = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;
      const trend = growthRate > 5 ? 'rising' : growthRate < -5 ? 'declining' : 'stable';

      return {
        brand,
        thisWeek,
        lastWeek,
        growthRate: Math.round(growthRate * 10) / 10,
        trend,
        totalOrders: brandOrders.length,
      };
    });

    // ═══════════════════════════════════════════════════════════════════════════════
    // INVENTORY FORECAST
    // ═══════════════════════════════════════════════════════════════════════════════
    const totalInventory = inventory.reduce((sum: number, inv: any) => sum + (inv.current_tubes_left || 0), 0);
    const lowStockStores = inventory.filter((inv: any) => (inv.current_tubes_left || 0) < 50);
    
    const avgDailyConsumption = brandPerformance.reduce((sum, b) => sum + b.thisWeek, 0) / 7;
    const daysUntilCritical = avgDailyConsumption > 0 ? Math.floor(totalInventory / avgDailyConsumption) : 999;

    // ═══════════════════════════════════════════════════════════════════════════════
    // UNPAID RISK ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════════
    const unpaidPayments = payments.filter((p: any) => p.payment_status !== 'paid');
    const totalUnpaid = unpaidPayments.reduce((sum: number, p: any) => sum + ((p.owed_amount || 0) - (p.paid_amount || 0)), 0);
    
    const highRiskAccounts = unpaidPayments.filter((p: any) => {
      const daysPastDue = p.due_date 
        ? Math.floor((Date.now() - new Date(p.due_date).getTime()) / (1000 * 60 * 60 * 24))
        : 30;
      return daysPastDue > 30 || (p.owed_amount || 0) > 2000;
    });

    // ═══════════════════════════════════════════════════════════════════════════════
    // STORE RANKINGS
    // ═══════════════════════════════════════════════════════════════════════════════
    const storePerformance = stores.slice(0, 20).map((store: any) => {
      const storeOrders = orders.filter((o: any) => o.store_id === store.id);
      const totalTubes = storeOrders.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0);
      const recentOrders = storeOrders.filter((o: any) => new Date(o.created_at) >= oneWeekAgo);
      
      return {
        id: store.id,
        name: store.name,
        neighborhood: store.neighborhood,
        totalTubes,
        recentActivity: recentOrders.length,
        score: Math.min(100, totalTubes / 10 + recentOrders.length * 5),
      };
    }).sort((a: any, b: any) => b.score - a.score);

    const topStores = storePerformance.slice(0, 10);
    const failingStores = storePerformance
      .filter((s: any) => s.score < 20 || s.recentActivity === 0)
      .slice(0, 10);

    // ═══════════════════════════════════════════════════════════════════════════════
    // AMBASSADOR RANKINGS
    // ═══════════════════════════════════════════════════════════════════════════════
    const ambassadorRankings = ambassadors.map((amb: any) => ({
      id: amb.id,
      name: amb.profiles?.full_name || 'Unknown',
      tier: amb.tier,
      totalEarnings: amb.total_earnings || 0,
      trackingCode: amb.tracking_code,
      score: Math.min(100, (amb.total_earnings || 0) / 100),
    })).sort((a: any, b: any) => b.score - a.score).slice(0, 10);

    // ═══════════════════════════════════════════════════════════════════════════════
    // BOTTLENECKS
    // ═══════════════════════════════════════════════════════════════════════════════
    const bottlenecks = [];
    
    if (lowStockStores.length > 5) {
      bottlenecks.push({
        area: 'Inventory',
        severity: lowStockStores.length > 10 ? 'critical' : 'warning',
        description: `${lowStockStores.length} stores with low stock`,
        action: 'Schedule restocking runs',
      });
    }

    if (highRiskAccounts.length > 3) {
      bottlenecks.push({
        area: 'Collections',
        severity: highRiskAccounts.length > 8 ? 'critical' : 'warning',
        description: `${highRiskAccounts.length} high-risk unpaid accounts`,
        action: 'Initiate collection follow-ups',
      });
    }

    const activeDrivers = drivers.filter((d: any) => d.active).length;
    if (activeDrivers < 3 && lowStockStores.length > 5) {
      bottlenecks.push({
        area: 'Delivery Capacity',
        severity: 'warning',
        description: `Only ${activeDrivers} active drivers for ${lowStockStores.length} pending restocks`,
        action: 'Activate additional drivers',
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PIPELINE FORECAST
    // ═══════════════════════════════════════════════════════════════════════════════
    const avgWeeklyOrders = orders.length / 4; // Estimate
    const avgOrderValue = orders.length > 0 
      ? orders.reduce((sum: number, o: any) => sum + (o.total_value || 0), 0) / orders.length 
      : 500;

    const weekPipeline = {
      expectedOrders: Math.round(avgWeeklyOrders),
      expectedRevenue: Math.round(avgWeeklyOrders * avgOrderValue),
      deliveriesScheduled: lowStockStores.length,
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // OVERALL HEALTH SCORE
    // ═══════════════════════════════════════════════════════════════════════════════
    let healthScore = 100;
    healthScore -= bottlenecks.filter((b: any) => b.severity === 'critical').length * 15;
    healthScore -= bottlenecks.filter((b: any) => b.severity === 'warning').length * 5;
    healthScore -= lowStockStores.length * 2;
    healthScore -= highRiskAccounts.length * 3;
    healthScore = Math.max(0, Math.min(100, healthScore));

    // ═══════════════════════════════════════════════════════════════════════════════
    // GENERATE REPORT
    // ═══════════════════════════════════════════════════════════════════════════════
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        overallHealth: healthScore,
        criticalAlerts: bottlenecks.filter((b: any) => b.severity === 'critical').length,
        opportunities: failingStores.length,
        totalStores: stores.length,
        totalAmbassadors: ambassadors.length,
        activeDrivers,
      },
      brandPerformance,
      inventoryForecast: {
        estimatedTotal: totalInventory,
        daysUntilCritical,
        lowStockCount: lowStockStores.length,
        restockNeeded: lowStockStores.map((s: any) => s.store_id),
      },
      unpaidRisk: {
        totalAmount: totalUnpaid,
        highRiskAccounts: highRiskAccounts.length,
        topDebtors: highRiskAccounts.slice(0, 5).map((p: any) => ({
          id: p.id,
          amount: (p.owed_amount || 0) - (p.paid_amount || 0),
        })),
      },
      bottlenecks,
      topStores,
      failingStores,
      ambassadorRankings,
      weekPipeline,
    };

    console.log("Intelligence Report Generated:", {
      health: healthScore,
      alerts: bottlenecks.length,
      stores: stores.length,
    });

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating intelligence report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
