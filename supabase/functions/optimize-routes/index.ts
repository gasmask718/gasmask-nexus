import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine distance formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Greedy nearest neighbor TSP approximation
function optimizeRoute(stores: any[]) {
  if (stores.length === 0) return { stores: [], distance: 0 };
  
  const route = [stores[0]];
  const remaining = stores.slice(1);
  let totalDistance = 0;

  while (remaining.length > 0) {
    const current = route[route.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    remaining.forEach((store, idx) => {
      const dist = calculateDistance(current.lat, current.lng, store.lat, store.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });

    route.push(remaining[nearestIdx]);
    totalDistance += nearestDist;
    remaining.splice(nearestIdx, 1);
  }

  return { stores: route, distance: totalDistance };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date, territory } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch stores that need visits with urgency scores
    let query = supabase
      .from('stores')
      .select(`
        id, name, lat, lng, type, 
        store_product_state(urgency_score)
      `)
      .eq('status', 'active')
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    if (territory) {
      query = query.contains('tags', [territory]);
    }

    const { data: stores, error: storesError } = await query;
    if (storesError) throw storesError;

    // Add urgency scores
    const storesWithUrgency = stores.map(store => ({
      ...store,
      urgency: store.store_product_state?.[0]?.urgency_score || 0
    }));

    // Sort by urgency
    storesWithUrgency.sort((a, b) => b.urgency - a.urgency);

    // Get available drivers
    const { data: drivers } = await supabase
      .from('profiles')
      .select('id, name, role')
      .in('role', ['driver', 'biker'])
      .limit(8);

    if (!drivers || drivers.length === 0) {
      throw new Error('No drivers available');
    }

    // Cluster stores into groups (6-15 per route)
    const routes = [];
    const storesPerRoute = Math.ceil(storesWithUrgency.length / drivers.length);
    const targetStopsPerRoute = Math.min(15, Math.max(6, storesPerRoute));

    for (let i = 0; i < drivers.length; i++) {
      const startIdx = i * targetStopsPerRoute;
      const endIdx = Math.min(startIdx + targetStopsPerRoute, storesWithUrgency.length);
      const routeStores = storesWithUrgency.slice(startIdx, endIdx);

      if (routeStores.length === 0) continue;

      // Optimize route order
      const optimized = optimizeRoute(routeStores);
      const estimatedDuration = Math.round(optimized.distance * 4 + routeStores.length * 15);
      const estimatedProfit = routeStores.reduce((sum, s) => sum + (s.urgency * 5), 0);
      const optimizationScore = Math.round(
        (routeStores.length * 10) + 
        (100 - optimized.distance * 2) + 
        (estimatedProfit / 10)
      );

      // Create route
      const { data: newRoute, error: routeError } = await supabase
        .from('routes')
        .insert({
          date: date || new Date().toISOString().split('T')[0],
          type: drivers[i].role,
          territory: territory || 'Multi-Zone',
          assigned_to: drivers[i].id,
          status: 'planned',
          estimated_distance_km: Math.round(optimized.distance * 10) / 10,
          estimated_duration_minutes: estimatedDuration,
          estimated_profit: Math.round(estimatedProfit),
          optimization_score: optimizationScore,
          is_optimized: true
        })
        .select()
        .single();

      if (routeError) {
        console.error('Route creation error:', routeError);
        continue;
      }

      // Create route stops
      const stops = optimized.stores.map((store, idx) => ({
        route_id: newRoute.id,
        store_id: store.id,
        planned_order: idx + 1,
        status: 'pending'
      }));

      const { error: stopsError } = await supabase
        .from('route_stops')
        .insert(stops);

      if (stopsError) {
        console.error('Stops creation error:', stopsError);
      }

      routes.push({
        id: newRoute.id,
        driver: drivers[i].name,
        stops: optimized.stores.length,
        distance: Math.round(optimized.distance * 10) / 10,
        duration: estimatedDuration,
        profit: Math.round(estimatedProfit),
        score: optimizationScore
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        routes_created: routes.length,
        routes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});