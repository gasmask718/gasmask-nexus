import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mode, poId, receivedItems } = await req.json();

    let result = {
      success: true,
      orders_routed: 0,
      stock_updates: 0,
      ai_insights_created: 0,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MODE: ROUTE ORDERS
    // ═══════════════════════════════════════════════════════════════════════════
    if (mode === "route_orders") {
      // Get unrouted paid orders
      const { data: orders } = await supabase
        .from("marketplace_orders")
        .select("*, items:marketplace_order_items(*)")
        .eq("status", "paid");

      if (!orders?.length) {
        return new Response(JSON.stringify({ ...result, message: "No orders to route" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get available warehouses
      const { data: warehouses } = await supabase
        .from("warehouses")
        .select("*")
        .eq("is_active", true);

      // Get inventory stock
      const { data: stocks } = await supabase
        .from("inventory_stock")
        .select("*");

      for (const order of orders) {
        // Simple routing logic: find warehouse with stock
        const warehouseId = warehouses?.[0]?.id;

        if (warehouseId) {
          // Create or update order routing
          const { error: routingError } = await supabase
            .from("order_routing")
            .upsert({
              order_id: order.id,
              warehouse_id: warehouseId,
              fulfillment_type: "ship_from_warehouse",
              status: "pending",
            }, { onConflict: "order_id" });

          if (!routingError) {
            result.orders_routed++;

            // Reserve stock for order items
            for (const item of order.items || []) {
              const stockRecord = stocks?.find(
                (s: any) => s.product_id === item.product_id && s.warehouse_id === warehouseId
              );

              if (stockRecord) {
                await supabase
                  .from("inventory_stock")
                  .update({
                    quantity_reserved: (stockRecord.quantity_reserved || 0) + item.quantity,
                  })
                  .eq("id", stockRecord.id);

                // Log movement
                await supabase.from("inventory_movements").insert({
                  product_id: item.product_id,
                  to_warehouse_id: warehouseId,
                  movement_type: "reservation",
                  quantity: item.quantity,
                  reference_type: "marketplace_order",
                  reference_id: order.id,
                });

                result.stock_updates++;
              }
            }
          }
        }
      }

      console.log(`[warehouse-brain] Routed ${result.orders_routed} orders`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODE: RECEIVE PO
    // ═══════════════════════════════════════════════════════════════════════════
    if (mode === "receive_po" && poId) {
      // Get PO details
      const { data: po } = await supabase
        .from("purchase_orders")
        .select("*, items:purchase_order_items(*)")
        .eq("id", poId)
        .single();

      if (po) {
        // Update each item's received quantity
        for (const item of receivedItems || po.items || []) {
          const qtyReceived = item.quantity_received || item.quantity_ordered;

          // Update PO item
          await supabase
            .from("purchase_order_items")
            .update({ quantity_received: qtyReceived })
            .eq("id", item.id);

          // Update or create inventory stock
          const { data: existingStock } = await supabase
            .from("inventory_stock")
            .select("*")
            .eq("product_id", item.product_id)
            .eq("warehouse_id", po.warehouse_location)
            .single();

          if (existingStock) {
            await supabase
              .from("inventory_stock")
              .update({
                quantity_on_hand: (existingStock.quantity_on_hand || 0) + qtyReceived,
              })
              .eq("id", existingStock.id);
          } else {
            await supabase.from("inventory_stock").insert({
              product_id: item.product_id,
              warehouse_id: po.warehouse_location,
              quantity_on_hand: qtyReceived,
            });
          }

          // Log movement
          await supabase.from("inventory_movements").insert({
            product_id: item.product_id,
            to_warehouse_id: po.warehouse_location,
            movement_type: "supplier_in",
            quantity: qtyReceived,
            reference_type: "purchase_order",
            reference_id: po.id,
          });

          result.stock_updates++;
        }

        // Mark PO as received
        await supabase
          .from("purchase_orders")
          .update({ status: "received" })
          .eq("id", poId);

        console.log(`[warehouse-brain] Received PO ${poId}, ${result.stock_updates} items`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODE: RESTOCK INSIGHTS
    // ═══════════════════════════════════════════════════════════════════════════
    if (mode === "restock_insights") {
      // Get low stock items
      const { data: lowStock } = await supabase
        .from("inventory_stock")
        .select("*")
        .not("reorder_point", "is", null);

      const criticalItems = (lowStock || []).filter(
        (s: any) => (s.quantity_on_hand || 0) <= (s.reorder_point || 0)
      );

      // Create AI work tasks for critical items
      for (const item of criticalItems.slice(0, 10)) {
        const { error } = await supabase.from("ai_work_tasks").insert({
          task_title: `Restock Alert: Low inventory`,
          task_details: `Product ${item.product_id} is at ${item.quantity_on_hand} units, below reorder point of ${item.reorder_point}`,
          department: "Operations",
          priority: "high",
          status: "pending",
          tags: ["restock", "inventory", "urgent"],
        });

        if (!error) result.ai_insights_created++;
      }

      console.log(`[warehouse-brain] Created ${result.ai_insights_created} restock insights`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[warehouse-brain] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
