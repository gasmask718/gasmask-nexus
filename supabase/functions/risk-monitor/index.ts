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

    const alerts = [];

    // Check 1: Stores never visited
    const { data: neverVisitedStores } = await supabase
      .from('stores')
      .select('id, name')
      .not('status', 'eq', 'inactive')
      .is('id', null); // Will be filtered by left join

    const { data: storesWithoutVisits } = await supabase
      .from('stores')
      .select(`
        id,
        name,
        created_at,
        visit_logs(id)
      `)
      .not('status', 'eq', 'inactive')
      .limit(100);

    const neverVisited = storesWithoutVisits?.filter(s => 
      !s.visit_logs || s.visit_logs.length === 0
    ) || [];

    for (const store of neverVisited) {
      const daysSinceCreation = Math.floor(
        (Date.now() - new Date(store.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceCreation > 7) {
        alerts.push({
          alert_type: 'store_never_visited',
          severity: daysSinceCreation > 30 ? 'high' : 'medium',
          entity_type: 'store',
          entity_id: store.id,
          message: `${store.name} added ${daysSinceCreation} days ago but never visited`,
          details: { days_since_creation: daysSinceCreation }
        });
      }
    }

    // Check 2: Territory gaps (no visits in 14+ days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: recentVisits } = await supabase
      .from('visit_logs')
      .select('store_id, stores(id, address_city)')
      .gte('visit_datetime', fourteenDaysAgo.toISOString());

    const { data: allStores } = await supabase
      .from('stores')
      .select('id, name, address_city')
      .eq('status', 'active');

    const visitedStoreIds = new Set(recentVisits?.map(v => v.store_id) || []);
    const cityGaps: { [key: string]: number } = {};

    for (const store of allStores || []) {
      if (!visitedStoreIds.has(store.id) && store.address_city) {
        cityGaps[store.address_city] = (cityGaps[store.address_city] || 0) + 1;
      }
    }

    for (const [city, count] of Object.entries(cityGaps)) {
      if (count >= 3) {
        alerts.push({
          alert_type: 'territory_gap',
          severity: count >= 5 ? 'high' : 'medium',
          entity_type: 'territory',
          entity_id: null,
          message: `${city} has ${count} stores with no visits in 14+ days`,
          details: { city, store_count: count, days: 14 }
        });
      }
    }

    // Check 3: Sudden drop in order frequency
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: recentDeliveries } = await supabase
      .from('visit_logs')
      .select('store_id, stores(name)')
      .eq('visit_type', 'delivery')
      .gte('visit_datetime', thirtyDaysAgo.toISOString());

    const { data: olderDeliveries } = await supabase
      .from('visit_logs')
      .select('store_id')
      .eq('visit_type', 'delivery')
      .gte('visit_datetime', sixtyDaysAgo.toISOString())
      .lt('visit_datetime', thirtyDaysAgo.toISOString());

    const recentDeliveryCount: { [key: string]: number } = {};
    const olderDeliveryCount: { [key: string]: number } = {};

    for (const delivery of recentDeliveries || []) {
      recentDeliveryCount[delivery.store_id] = (recentDeliveryCount[delivery.store_id] || 0) + 1;
    }

    for (const delivery of olderDeliveries || []) {
      olderDeliveryCount[delivery.store_id] = (olderDeliveryCount[delivery.store_id] || 0) + 1;
    }

    for (const [storeId, oldCount] of Object.entries(olderDeliveryCount)) {
      const newCount = recentDeliveryCount[storeId] || 0;
      const dropPercent = ((oldCount - newCount) / oldCount) * 100;

      if (dropPercent >= 50 && oldCount >= 3) {
        const storeData = recentDeliveries?.find(d => d.store_id === storeId);
        const storeName = storeData?.stores && typeof storeData.stores === 'object' && 'name' in storeData.stores 
          ? storeData.stores.name 
          : 'Store';
        alerts.push({
          alert_type: 'order_frequency_drop',
          severity: 'high',
          entity_type: 'store',
          entity_id: storeId,
          message: `${storeName} orders dropped ${Math.round(dropPercent)}% in last 30 days`,
          details: { old_count: oldCount, new_count: newCount, drop_percent: dropPercent }
        });
      }
    }

    // Check 4: Prospect clusters (5+ uncontacted prospects in same area)
    const { data: prospects } = await supabase
      .from('stores')
      .select('id, name, address_city, created_at')
      .eq('status', 'prospect');

    const { data: prospectComms } = await supabase
      .from('communication_events')
      .select('store_id')
      .in('store_id', prospects?.map(p => p.id) || []);

    const contactedProspectIds = new Set(prospectComms?.map(c => c.store_id) || []);
    const uncontactedByCity: { [key: string]: any[] } = {};

    for (const prospect of prospects || []) {
      if (!contactedProspectIds.has(prospect.id) && prospect.address_city) {
        if (!uncontactedByCity[prospect.address_city]) {
          uncontactedByCity[prospect.address_city] = [];
        }
        uncontactedByCity[prospect.address_city].push(prospect);
      }
    }

    for (const [city, prospectsInCity] of Object.entries(uncontactedByCity)) {
      if (prospectsInCity.length >= 5) {
        alerts.push({
          alert_type: 'prospect_cluster',
          severity: 'medium',
          entity_type: 'territory',
          entity_id: null,
          message: `${city} has ${prospectsInCity.length} uncontacted prospects`,
          details: { city, prospect_count: prospectsInCity.length }
        });
      }
    }

    // Check 5: Wholesale hubs inactive > 30 days
    const { data: inactiveHubs } = await supabase
      .from('wholesale_hubs')
      .select('id, name, updated_at')
      .eq('status', 'active');

    for (const hub of inactiveHubs || []) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(hub.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceUpdate > 30) {
        alerts.push({
          alert_type: 'inactive_wholesale_hub',
          severity: 'medium',
          entity_type: 'wholesale_hub',
          entity_id: hub.id,
          message: `${hub.name} inactive for ${daysSinceUpdate} days`,
          details: { days_inactive: daysSinceUpdate }
        });
      }
    }

    // Save all alerts
    if (alerts.length > 0) {
      const { error } = await supabase
        .from('risk_alerts')
        .insert(alerts);

      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts_created: alerts.length,
        alerts: alerts 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});