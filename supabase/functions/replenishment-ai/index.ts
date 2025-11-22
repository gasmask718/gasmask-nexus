import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { storeId } = await req.json();

    if (!storeId) {
      throw new Error("storeId is required");
    }

    console.log("Analyzing replenishment needs for store:", storeId);

    // Fetch store data
    const { data: store } = await supabaseClient
      .from("stores")
      .select("*, store_product_state(*)")
      .eq("id", storeId)
      .single();

    // Fetch recent orders from this store
    const { data: recentOrders } = await supabaseClient
      .from("wholesale_orders")
      .select("*, wholesale_order_items(*)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch recent visit logs
    const { data: recentVisits } = await supabaseClient
      .from("visit_logs")
      .select("*")
      .eq("store_id", storeId)
      .order("visit_datetime", { ascending: false })
      .limit(5);

    // Fetch available products
    const { data: availableProducts } = await supabaseClient
      .from("wholesale_products")
      .select("*, wholesale_hubs(name)")
      .eq("is_active", true)
      .order("category");

    // Calculate recommendations based on:
    // 1. Products frequently ordered
    // 2. Products with low inventory
    // 3. Seasonal trends
    // 4. Time since last order

    const recommendations = [];

    // Analyze order history
    const productFrequency: Record<string, { count: number; productId: string; lastOrdered: string }> = {};
    
    if (recentOrders) {
      for (const order of recentOrders) {
        if (order.wholesale_order_items) {
          for (const item of order.wholesale_order_items) {
            const key = item.product_id;
            if (!productFrequency[key]) {
              productFrequency[key] = {
                count: 0,
                productId: item.product_id,
                lastOrdered: order.created_at,
              };
            }
            productFrequency[key].count += item.quantity;
          }
        }
      }
    }

    // Generate recommendations for frequently ordered products
    for (const [_, freq] of Object.entries(productFrequency)) {
      const product = availableProducts?.find((p) => p.id === freq.productId);
      if (product) {
        const daysSinceLastOrder = Math.floor(
          (Date.now() - new Date(freq.lastOrdered).getTime()) / (1000 * 60 * 60 * 24)
        );

        let score = 50; // Base score
        
        // Increase score if ordered frequently
        if (freq.count > 10) score += 30;
        else if (freq.count > 5) score += 20;
        else if (freq.count > 2) score += 10;

        // Increase score based on time since last order
        if (daysSinceLastOrder > 30) score += 25;
        else if (daysSinceLastOrder > 14) score += 15;
        else if (daysSinceLastOrder > 7) score += 5;

        const avgQuantity = Math.ceil(freq.count / (recentOrders?.length || 1));

        recommendations.push({
          product_id: product.id,
          product_name: product.name,
          product_category: product.category,
          product_price: product.price,
          case_size: product.case_size,
          wholesaler_name: product.wholesale_hubs?.name,
          recommended_quantity: Math.max(1, avgQuantity),
          stockout_risk_score: Math.min(100, score),
          reason: daysSinceLastOrder > 30
            ? `Last ordered ${daysSinceLastOrder} days ago - high risk of stockout`
            : daysSinceLastOrder > 14
            ? `Frequently ordered item - consider restocking`
            : `Regular reorder item - maintain inventory`,
          recommended_timing: daysSinceLastOrder > 21 ? "urgent" : daysSinceLastOrder > 14 ? "soon" : "routine",
        });
      }
    }

    // Add recommendations for products with low inventory
    if (store?.store_product_state) {
      for (const productState of store.store_product_state) {
        if (
          productState.last_inventory_level === "empty" ||
          productState.last_inventory_level === "quarter"
        ) {
          const product = availableProducts?.find(
            (p) => p.id === productState.product_id
          );
          if (product && !recommendations.find((r) => r.product_id === product.id)) {
            recommendations.push({
              product_id: product.id,
              product_name: product.name,
              product_category: product.category,
              product_price: product.price,
              case_size: product.case_size,
              wholesaler_name: product.wholesale_hubs?.name,
              recommended_quantity: 2,
              stockout_risk_score: productState.urgency_score || 75,
              reason: "Low inventory detected during last visit",
              recommended_timing: "urgent",
            });
          }
        }
      }
    }

    // Sort by stockout risk score
    recommendations.sort((a, b) => b.stockout_risk_score - a.stockout_risk_score);

    console.log(`Generated ${recommendations.length} recommendations for store ${storeId}`);

    return new Response(
      JSON.stringify({
        store_id: storeId,
        store_name: store?.name,
        recommendations: recommendations.slice(0, 10), // Top 10 recommendations
        analysis: {
          total_past_orders: recentOrders?.length || 0,
          recent_visits: recentVisits?.length || 0,
          days_since_last_order: recentOrders?.length
            ? Math.floor(
                (Date.now() - new Date(recentOrders[0].created_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in replenishment-ai:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});