import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { brand, timeframe = 'today' } = await req.json();

    // Calculate date range
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate = startOfToday;

    if (timeframe === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Fetch all stores with new fields
    const { data: stores } = await supabaseClient
      .from('stores')
      .select('id, name, address_city, address_state, neighborhood, boro, status, sells_flowers, prime_time_energy, rpa_status, health_score, region_id');

    // Calculate store metrics by region/state/boro
    const storesByState: Record<string, number> = {};
    const storesByBoro: Record<string, number> = {};
    const activeStores = stores?.filter(s => s.status === 'active').length || 0;
    const rpaStores = stores?.filter(s => s.rpa_status === 'rpa').length || 0;
    const flowerStores = stores?.filter(s => s.sells_flowers).length || 0;
    const primeTimeStores = stores?.filter(s => s.prime_time_energy).length || 0;

    stores?.forEach(store => {
      if (store.address_state) {
        storesByState[store.address_state] = (storesByState[store.address_state] || 0) + 1;
      }
      if (store.boro) {
        storesByBoro[store.boro] = (storesByBoro[store.boro] || 0) + 1;
      }
    });

    // Fetch orders with brand and tubes
    const { data: orders } = await supabaseClient
      .from('wholesale_orders')
      .select('id, store_id, brand, total, subtotal, created_at, order_date, boxes, tubes_per_box')
      .gte('created_at', startDate.toISOString());

    const ordersCount = orders?.length || 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || o.subtotal || 0), 0) || 0;

    // Calculate tubes sold
    const tubesSold = orders?.reduce((sum, o) => {
      const boxes = o.boxes || 1;
      const tubesPerBox = o.tubes_per_box || 50;
      return sum + (boxes * tubesPerBox);
    }, 0) || 0;

    // Orders by brand
    const ordersByBrand: Record<string, { count: number; revenue: number; tubes: number }> = {};
    orders?.forEach(order => {
      const b = order.brand || 'unknown';
      if (!ordersByBrand[b]) {
        ordersByBrand[b] = { count: 0, revenue: 0, tubes: 0 };
      }
      ordersByBrand[b].count++;
      ordersByBrand[b].revenue += order.total || order.subtotal || 0;
      ordersByBrand[b].tubes += (order.boxes || 1) * (order.tubes_per_box || 50);
    });

    // Fetch tube inventory
    const { data: inventory } = await supabaseClient
      .from('store_tube_inventory')
      .select('store_id, brand, current_tubes_left');

    const totalTubesInStock = inventory?.reduce((sum, i) => sum + (i.current_tubes_left || 0), 0) || 0;
    const inventoryByBrand: Record<string, number> = {};
    inventory?.forEach(inv => {
      inventoryByBrand[inv.brand] = (inventoryByBrand[inv.brand] || 0) + (inv.current_tubes_left || 0);
    });

    // Fetch deliveries
    const { data: routes } = await supabaseClient
      .from('routes')
      .select('status, created_at')
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString());

    const deliveriesCompleted = routes?.length || 0;

    // Fetch new stores
    const { count: newStoresCount } = await supabaseClient
      .from('stores')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    // Fetch communication volume
    const { data: comms } = await supabaseClient
      .from('communication_logs')
      .select('channel')
      .gte('created_at', startDate.toISOString());

    const commVolume = {
      sms: comms?.filter(c => c.channel === 'sms').length || 0,
      email: comms?.filter(c => c.channel === 'email').length || 0,
      ai_call: comms?.filter(c => c.channel === 'ai_call').length || 0,
      va_call: comms?.filter(c => c.channel === 'va_call').length || 0,
      total: comms?.length || 0,
    };

    // Fetch automations triggered
    const { count: automationsTriggered } = await supabaseClient
      .from('automation_logs')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    // Fetch payments status
    const { data: payments } = await supabaseClient
      .from('store_payments')
      .select('payment_status, owed_amount, paid_amount');

    const paymentStats = {
      totalOwed: payments?.reduce((sum, p) => sum + (p.owed_amount || 0), 0) || 0,
      totalPaid: payments?.reduce((sum, p) => sum + (p.paid_amount || 0), 0) || 0,
      unpaidCount: payments?.filter(p => p.payment_status === 'unpaid').length || 0,
      paidCount: payments?.filter(p => p.payment_status === 'paid').length || 0,
    };

    // Brand-specific data
    let brandData = null;
    if (brand) {
      const brandOrders = orders?.filter(o => o.brand === brand) || [];
      const brandRevenue = brandOrders.reduce((sum, o) => sum + (o.total || o.subtotal || 0), 0);
      const brandTubes = brandOrders.reduce((sum, o) => sum + ((o.boxes || 1) * (o.tubes_per_box || 50)), 0);

      // Get unique stores that ordered this brand
      const brandStoreIds = [...new Set(brandOrders.map(o => o.store_id))];
      const brandStores = stores?.filter(s => brandStoreIds.includes(s.id)) || [];

      // Top neighborhoods/boros for this brand
      const neighborhoodCounts: Record<string, number> = {};
      const boroCounts: Record<string, number> = {};
      brandStores.forEach(s => {
        if (s.neighborhood) neighborhoodCounts[s.neighborhood] = (neighborhoodCounts[s.neighborhood] || 0) + 1;
        if (s.boro) boroCounts[s.boro] = (boroCounts[s.boro] || 0) + 1;
      });

      brandData = {
        activeAccounts: brandStores.length,
        revenue: brandRevenue,
        tubesSold: brandTubes,
        orders: brandOrders.length,
        topNeighborhoods: Object.entries(neighborhoodCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
        topBoros: Object.entries(boroCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
        inventoryInStock: inventoryByBrand[brand] || 0,
      };
    }

    // Heat map data
    const heatMapData = {
      byState: Object.entries(storesByState).map(([state, count]) => {
        const stateStores = stores?.filter(s => s.address_state === state) || [];
        const avgHealth = stateStores.length > 0 
          ? Math.round(stateStores.reduce((sum, s) => sum + (s.health_score || 50), 0) / stateStores.length)
          : 50;
        return { state, count, avgHealth };
      }),
      byBoro: Object.entries(storesByBoro).map(([boro, count]) => {
        const boroStores = stores?.filter(s => s.boro === boro) || [];
        const avgHealth = boroStores.length > 0
          ? Math.round(boroStores.reduce((sum, s) => sum + (s.health_score || 50), 0) / boroStores.length)
          : 50;
        return { boro, count, avgHealth };
      }),
    };

    return new Response(JSON.stringify({
      success: true,
      timeframe,
      metrics: {
        totalRevenue,
        ordersToday: ordersCount,
        deliveriesCompleted,
        newStores: newStoresCount || 0,
        communicationVolume: commVolume,
        automationsTriggered: automationsTriggered || 0,
        tubesSold,
        totalTubesInStock,
        activeStores,
        rpaStores,
        flowerStores,
        primeTimeStores,
        totalStores: stores?.length || 0,
      },
      ordersByBrand,
      inventoryByBrand,
      paymentStats,
      heatMapData,
      brandData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ceo-dashboard-metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
