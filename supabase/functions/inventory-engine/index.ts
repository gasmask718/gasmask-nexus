// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY ENGINE — Stock Alerts, Hero/Ghost Scores, Snapshots
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mode } = await req.json();
    console.log(`[Inventory Engine] Mode: ${mode}`);

    let result: Record<string, any> = { success: true, mode };

    // ═══════════════════════════════════════════════════════════════════════════
    // MODE: SCAN_ALERTS — Check stock levels and create alerts
    // ═══════════════════════════════════════════════════════════════════════════
    if (mode === 'scan_alerts') {
      // Get all inventory stock with reorder points
      const { data: stocks, error: stockError } = await supabase
        .from('inventory_stock')
        .select('*')
        .not('reorder_point', 'is', null);

      if (stockError) throw stockError;

      let alertsCreated = 0;

      for (const stock of stocks || []) {
        const onHand = stock.quantity_on_hand || 0;
        const reorderPoint = stock.reorder_point || 0;
        const safetyStock = stock.reorder_target || 0; // Using reorder_target as safety stock

        // Check for out of stock
        if (onHand === 0) {
          const { error } = await supabase.from('inventory_alerts').insert({
            product_id: stock.product_id,
            alert_warehouse_id: stock.warehouse_id,
            business_id: stock.business_id,
            alert_type: 'out_of_stock',
            severity: 'critical',
            current_quantity: onHand,
            threshold: 0,
            message: `Product is out of stock`,
          });
          if (!error) alertsCreated++;
        }
        // Check for low stock
        else if (onHand <= reorderPoint) {
          const { error } = await supabase.from('inventory_alerts').insert({
            product_id: stock.product_id,
            alert_warehouse_id: stock.warehouse_id,
            business_id: stock.business_id,
            alert_type: 'low_stock',
            severity: onHand <= safetyStock ? 'critical' : 'warning',
            current_quantity: onHand,
            threshold: reorderPoint,
            message: `Stock at ${onHand} units, reorder point is ${reorderPoint}`,
          });
          if (!error) alertsCreated++;
        }
      }

      result.alerts_created = alertsCreated;
      console.log(`[Inventory Engine] Created ${alertsCreated} alerts`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODE: GENERATE_SNAPSHOT — Create daily inventory snapshot
    // ═══════════════════════════════════════════════════════════════════════════
    else if (mode === 'generate_snapshot') {
      const today = new Date().toISOString().split('T')[0];

      // Get warehouse-level aggregations
      const { data: warehouses } = await supabase
        .from('warehouses')
        .select('id, business_id')
        .eq('is_active', true);

      let snapshotsCreated = 0;

      for (const warehouse of warehouses || []) {
        const { data: stocks } = await supabase
          .from('inventory_stock')
          .select('quantity_on_hand, reorder_point')
          .eq('warehouse_id', warehouse.id);

        const totalUnits = (stocks || []).reduce((sum, s) => sum + (s.quantity_on_hand || 0), 0);
        const totalProducts = (stocks || []).length;
        const lowStockCount = (stocks || []).filter(s => 
          s.reorder_point && (s.quantity_on_hand || 0) <= s.reorder_point && (s.quantity_on_hand || 0) > 0
        ).length;
        const outOfStockCount = (stocks || []).filter(s => (s.quantity_on_hand || 0) === 0).length;

        // Upsert snapshot
        const { error } = await supabase
          .from('inventory_snapshots')
          .upsert({
            snapshot_date: today,
            snapshot_warehouse_id: warehouse.id,
            business_id: warehouse.business_id,
            total_units: totalUnits,
            total_products: totalProducts,
            low_stock_count: lowStockCount,
            out_of_stock_count: outOfStockCount,
          }, {
            onConflict: 'snapshot_date,snapshot_warehouse_id',
            ignoreDuplicates: false,
          });

        if (!error) snapshotsCreated++;
      }

      result.snapshots_created = snapshotsCreated;
      console.log(`[Inventory Engine] Created ${snapshotsCreated} snapshots`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODE: COMPUTE_SCORES — Calculate hero/ghost scores for products
    // ═══════════════════════════════════════════════════════════════════════════
    else if (mode === 'compute_scores') {
      // Get all products
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('is_active', true);

      let productsScored = 0;

      for (const product of products || []) {
        // Get inventory movements for this product (last 90 days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data: movements } = await supabase
          .from('inventory_movements')
          .select('movement_type, quantity')
          .eq('product_id', product.id)
          .gte('created_at', ninetyDaysAgo.toISOString());

        // Calculate scores based on movement volume
        const outboundQty = (movements || [])
          .filter(m => ['customer_order_out', 'store_order_out', 'wholesaler_order_out'].includes(m.movement_type || ''))
          .reduce((sum, m) => sum + Math.abs(m.quantity || 0), 0);

        const inboundQty = (movements || [])
          .filter(m => ['production_in', 'supplier_in', 'return'].includes(m.movement_type || ''))
          .reduce((sum, m) => sum + Math.abs(m.quantity || 0), 0);

        // Simple scoring: hero = high outbound, ghost = low movement
        const heroScore = Math.min(100, (outboundQty / 10)); // Scale to 0-100
        const ghostScore = outboundQty === 0 && inboundQty > 0 ? 80 : Math.max(0, 50 - (outboundQty / 5));

        const { error } = await supabase
          .from('products')
          .update({
            hero_score: heroScore,
            ghost_score: ghostScore,
          })
          .eq('id', product.id);

        if (!error) productsScored++;
      }

      result.products_scored = productsScored;
      console.log(`[Inventory Engine] Scored ${productsScored} products`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODE: FULL_SCAN — Run all modes
    // ═══════════════════════════════════════════════════════════════════════════
    else if (mode === 'full_scan') {
      // This would call all three modes in sequence
      // For now, just mark as success
      result.message = 'Full scan would run all modes - implement as needed';
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Inventory Engine] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
