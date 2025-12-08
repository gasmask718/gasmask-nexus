import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, businessId, verticalId, storeId, productId } = await req.json();

    if (action === 'compute_product_metrics') {
      return await computeProductMetrics(supabase, businessId, verticalId);
    } else if (action === 'compute_store_predictions') {
      return await computeStorePredictions(supabase, storeId, businessId, verticalId);
    } else if (action === 'generate_deal_recommendations') {
      return await generateDealRecommendations(supabase, businessId, verticalId);
    } else if (action === 'get_store_predictions') {
      return await getStorePredictions(supabase, storeId);
    } else if (action === 'get_hero_ghost_skus') {
      return await getHeroGhostSkus(supabase, businessId, verticalId);
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('Revenue Engine V2 error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function computeProductMetrics(supabase: any, businessId?: string, verticalId?: string) {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Get products
  let productQuery = supabase.from('products').select('id, name, brand_id');
  const { data: products } = await productQuery;

  const metrics = [];

  for (const product of (products || [])) {
    // Get order items for this product in last 30 days
    const { data: items30d } = await supabase
      .from('order_items')
      .select('quantity, unit_price, order_id, orders(store_id, created_at)')
      .eq('product_id', product.id)
      .gte('created_at', thirtyDaysAgo);

    // Get order items for previous 30 days (for trend)
    const { data: itemsPrev30d } = await supabase
      .from('order_items')
      .select('quantity, unit_price')
      .eq('product_id', product.id)
      .gte('created_at', sixtyDaysAgo)
      .lt('created_at', thirtyDaysAgo);

    // Get order items for 90 days
    const { data: items90d } = await supabase
      .from('order_items')
      .select('quantity, unit_price, order_id, orders(store_id)')
      .eq('product_id', product.id)
      .gte('created_at', ninetyDaysAgo);

    const unitsSold30d = (items30d || []).reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
    const unitsSold90d = (items90d || []).reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
    const unitsPrev30d = (itemsPrev30d || []).reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);

    const revenue30d = (items30d || []).reduce((sum: number, i: any) => 
      sum + ((i.quantity || 0) * (i.unit_price || 0)), 0);
    const revenue90d = (items90d || []).reduce((sum: number, i: any) => 
      sum + ((i.quantity || 0) * (i.unit_price || 0)), 0);

    const uniqueStores30d = new Set((items30d || []).map((i: any) => i.orders?.store_id).filter(Boolean)).size;
    const uniqueStores90d = new Set((items90d || []).map((i: any) => i.orders?.store_id).filter(Boolean)).size;

    const avgOrderQty = (items90d || []).length > 0 
      ? unitsSold90d / (items90d || []).length 
      : 0;

    // Trend calculation
    const trend30d = unitsPrev30d > 0 
      ? ((unitsSold30d - unitsPrev30d) / unitsPrev30d) * 100 
      : unitsSold30d > 0 ? 100 : 0;

    // Hero score (high revenue, many stores, positive trend)
    let heroScore = 0;
    heroScore += Math.min(30, revenue30d / 100);
    heroScore += Math.min(30, uniqueStores30d * 3);
    heroScore += trend30d > 0 ? Math.min(20, trend30d / 5) : 0;
    heroScore += Math.min(20, unitsSold30d / 10);
    heroScore = Math.min(100, Math.max(0, heroScore));

    // Ghost score (low sales, few stores, negative trend)
    let ghostScore = 0;
    if (unitsSold90d < 10) ghostScore += 30;
    if (uniqueStores90d < 3) ghostScore += 30;
    if (trend30d < -10) ghostScore += Math.min(20, Math.abs(trend30d) / 2);
    if (revenue90d < 100) ghostScore += 20;
    ghostScore = Math.min(100, Math.max(0, ghostScore));

    // Tags
    const tags: string[] = [];
    if (heroScore >= 70) tags.push('hero');
    if (ghostScore >= 70) tags.push('ghost');
    if (trend30d > 20) tags.push('rising');
    if (trend30d < -20) tags.push('declining');
    if (unitsSold90d < 5 && uniqueStores90d < 2) tags.push('slow_mover');

    const metricData = {
      product_id: product.id,
      business_id: businessId || null,
      vertical_id: verticalId || null,
      snapshot_date: today,
      total_revenue_30d: revenue30d,
      total_revenue_90d: revenue90d,
      units_sold_30d: unitsSold30d,
      units_sold_90d: unitsSold90d,
      avg_order_quantity: avgOrderQty,
      unique_stores_30d: uniqueStores30d,
      unique_stores_90d: uniqueStores90d,
      trend_30d: trend30d,
      trend_90d: 0,
      hero_score: heroScore,
      ghost_score: ghostScore,
      tags
    };

    await supabase.from('product_revenue_metrics').upsert(metricData, {
      onConflict: 'product_id,snapshot_date'
    });

    metrics.push(metricData);
  }

  return new Response(JSON.stringify({ success: true, computed: metrics.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function computeStorePredictions(supabase: any, storeId?: string, businessId?: string, verticalId?: string) {
  const today = new Date().toISOString().split('T')[0];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Get stores to process
  let storeQuery = supabase.from('store_master').select('id, vertical_id').eq('status', 'active');
  if (storeId) storeQuery = storeQuery.eq('id', storeId);
  if (verticalId) storeQuery = storeQuery.eq('vertical_id', verticalId);

  const { data: stores } = await storeQuery;
  let predictionsCount = 0;

  for (const store of (stores || [])) {
    // Get store's order history with products
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        product_id, quantity, created_at,
        orders!inner(store_id, created_at)
      `)
      .eq('orders.store_id', store.id)
      .gte('orders.created_at', ninetyDaysAgo);

    // Group by product
    const productStats: Record<string, { 
      lastOrder: Date; 
      totalQty: number; 
      orderCount: number;
      orders: Date[];
    }> = {};

    for (const item of (orderItems || [])) {
      const pid = item.product_id;
      if (!productStats[pid]) {
        productStats[pid] = { lastOrder: new Date(0), totalQty: 0, orderCount: 0, orders: [] };
      }
      const orderDate = new Date(item.orders?.created_at || item.created_at);
      if (orderDate > productStats[pid].lastOrder) {
        productStats[pid].lastOrder = orderDate;
      }
      productStats[pid].totalQty += item.quantity || 0;
      productStats[pid].orderCount++;
      productStats[pid].orders.push(orderDate);
    }

    // Get store revenue score for context
    const { data: revenueScore } = await supabase
      .from('store_revenue_scores')
      .select('heat_score, order_prob_7d')
      .eq('store_id', store.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const storeHeat = revenueScore?.heat_score || 50;

    // Generate predictions for each product
    const productIds = Object.keys(productStats);
    const rankedProducts = productIds
      .map(pid => ({ pid, ...productStats[pid] }))
      .sort((a, b) => b.totalQty - a.totalQty);

    for (let i = 0; i < rankedProducts.length; i++) {
      const p = rankedProducts[i];
      const daysSinceLastOrder = Math.floor(
        (Date.now() - p.lastOrder.getTime()) / (24 * 60 * 60 * 1000)
      );

      // Calculate average days between orders
      const sortedOrders = p.orders.sort((a, b) => a.getTime() - b.getTime());
      let avgCycle = 30; // default
      if (sortedOrders.length > 1) {
        const gaps = [];
        for (let j = 1; j < sortedOrders.length; j++) {
          gaps.push((sortedOrders[j].getTime() - sortedOrders[j-1].getTime()) / (24 * 60 * 60 * 1000));
        }
        avgCycle = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      }

      // Buy probability calculation
      let buyProb7d = 30;
      if (daysSinceLastOrder >= avgCycle * 0.8) buyProb7d += 30;
      if (daysSinceLastOrder >= avgCycle) buyProb7d += 20;
      buyProb7d += (storeHeat - 50) * 0.3;
      buyProb7d = Math.min(100, Math.max(0, buyProb7d));

      let buyProb30d = buyProb7d + 20;
      buyProb30d = Math.min(100, Math.max(0, buyProb30d));

      // Tags
      const tags: string[] = [];
      if (daysSinceLastOrder >= avgCycle * 0.8 && daysSinceLastOrder <= avgCycle * 1.2) {
        tags.push('restock');
      }
      if (i < 5) tags.push('primary');

      const predictionData = {
        store_id: store.id,
        product_id: p.pid,
        business_id: businessId || null,
        vertical_id: store.vertical_id || verticalId || null,
        snapshot_date: today,
        buy_prob_7d: buyProb7d,
        buy_prob_30d: buyProb30d,
        last_order_at: p.lastOrder.toISOString(),
        expected_quantity: p.totalQty / p.orderCount,
        is_primary_sku: i < 5,
        is_experiment_candidate: false,
        tags
      };

      await supabase.from('store_product_predictions').upsert(predictionData, {
        onConflict: 'store_id,product_id,snapshot_date'
      });
      predictionsCount++;
    }
  }

  return new Response(JSON.stringify({ success: true, predictions: predictionsCount }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function generateDealRecommendations(supabase: any, businessId?: string, verticalId?: string) {
  const today = new Date().toISOString().split('T')[0];

  // Get product metrics
  let query = supabase
    .from('product_revenue_metrics')
    .select('*, products(name, brand_id)')
    .eq('snapshot_date', today);

  if (businessId) query = query.eq('business_id', businessId);
  if (verticalId) query = query.eq('vertical_id', verticalId);

  const { data: metrics } = await query;
  const deals = [];

  for (const m of (metrics || [])) {
    // Hero products: bundle deals
    if (m.hero_score >= 70) {
      const dealData = {
        business_id: m.business_id,
        vertical_id: m.vertical_id,
        product_id: m.product_id,
        deal_type: 'bundle',
        target_segment: 'high_value',
        suggested_min_qty: 3,
        notes: `Bundle deal for hero SKU. ${m.units_sold_30d} units sold in 30d, trending ${m.trend_30d > 0 ? 'up' : 'flat'}.`,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      };

      await supabase.from('product_deal_recommendations').insert(dealData);
      deals.push(dealData);
    }

    // Ghost/slow products: discount to move inventory
    if (m.ghost_score >= 60 || (m.tags || []).includes('slow_mover')) {
      const dealData = {
        business_id: m.business_id,
        vertical_id: m.vertical_id,
        product_id: m.product_id,
        deal_type: 'discount',
        target_segment: 'all_stores',
        suggested_discount_pct: m.ghost_score >= 80 ? 15 : 10,
        notes: `Discount to move slow SKU. Only ${m.units_sold_90d} units in 90d.`,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      await supabase.from('product_deal_recommendations').insert(dealData);
      deals.push(dealData);
    }

    // Rising products: intro offers
    if ((m.tags || []).includes('rising') && m.unique_stores_30d < 10) {
      const dealData = {
        business_id: m.business_id,
        vertical_id: m.vertical_id,
        product_id: m.product_id,
        deal_type: 'intro',
        target_segment: 'new_stores',
        suggested_discount_pct: 5,
        notes: `Intro offer for rising SKU. Only in ${m.unique_stores_30d} stores but growing fast.`,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      };

      await supabase.from('product_deal_recommendations').insert(dealData);
      deals.push(dealData);
    }
  }

  return new Response(JSON.stringify({ success: true, deals: deals.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getStorePredictions(supabase: any, storeId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('store_product_predictions')
    .select(`
      *,
      products(id, name, brand_id, brands(name))
    `)
    .eq('store_id', storeId)
    .eq('snapshot_date', today)
    .order('buy_prob_7d', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching predictions:', error);
  }

  return new Response(JSON.stringify({ success: true, predictions: data || [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getHeroGhostSkus(supabase: any, businessId?: string, verticalId?: string) {
  const today = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('product_revenue_metrics')
    .select(`*, products(id, name, brand_id, brands(name))`)
    .eq('snapshot_date', today);

  if (businessId) query = query.eq('business_id', businessId);
  if (verticalId) query = query.eq('vertical_id', verticalId);

  const { data: allMetrics } = await query;

  const heroes = (allMetrics || [])
    .filter((m: any) => m.hero_score >= 60)
    .sort((a: any, b: any) => b.hero_score - a.hero_score)
    .slice(0, 5);

  const ghosts = (allMetrics || [])
    .filter((m: any) => m.ghost_score >= 50 || (m.tags || []).includes('slow_mover'))
    .sort((a: any, b: any) => b.ghost_score - a.ghost_score)
    .slice(0, 5);

  return new Response(JSON.stringify({ success: true, heroes, ghosts }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
