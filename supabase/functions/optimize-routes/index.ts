import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// Types for clarity
interface Store {
  id: string;
  name: string;
  lat: number;
  lng: number;
  urgency: number;
}

interface Worker {
  id: string;
  name: string;
  role: string;
  trust_score: number;
  reliability_score: number;
  autonomy_level: string;
  trend_direction: string;
  has_sla_breaches: boolean;
  has_critical_exceptions: boolean;
}

interface OptimizedRoute {
  stores: Store[];
  distance: number;
}

interface RouteProposal {
  id: string;
  driver: string;
  driver_id: string;
  role: string;
  stops: number;
  distance: number;
  duration: number;
  profit: number;
  score: number;
  territory: string;
  stores: Store[];
  autonomy_eligible: boolean;
  guardrail_blocks: string[];
  risk_level: 'low' | 'medium' | 'high';
}

// Greedy nearest neighbor TSP approximation
function optimizeRouteByDistance(stores: Store[]): OptimizedRoute {
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

// Priority-first optimization (urgency > distance)
function optimizeRouteByPriority(stores: Store[]): OptimizedRoute {
  if (stores.length === 0) return { stores: [], distance: 0 };
  
  // Sort by urgency first
  const sorted = [...stores].sort((a, b) => b.urgency - a.urgency);
  
  // Calculate total distance
  let totalDistance = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalDistance += calculateDistance(
      sorted[i-1].lat, sorted[i-1].lng,
      sorted[i].lat, sorted[i].lng
    );
  }
  
  return { stores: sorted, distance: totalDistance };
}

// Balanced optimization (weighted combination)
function optimizeRouteBalanced(stores: Store[]): OptimizedRoute {
  if (stores.length === 0) return { stores: [], distance: 0 };
  
  // Start with highest urgency stop
  const sorted = [...stores].sort((a, b) => b.urgency - a.urgency);
  const route = [sorted[0]];
  const remaining = sorted.slice(1);
  let totalDistance = 0;

  while (remaining.length > 0) {
    const current = route[route.length - 1];
    let bestIdx = 0;
    let bestScore = -Infinity;

    remaining.forEach((store, idx) => {
      const dist = calculateDistance(current.lat, current.lng, store.lat, store.lng);
      // Balance urgency (higher = better) with distance (lower = better)
      const score = (store.urgency * 2) - (dist * 10);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    const next = remaining[bestIdx];
    totalDistance += calculateDistance(current.lat, current.lng, next.lat, next.lng);
    route.push(next);
    remaining.splice(bestIdx, 1);
  }

  return { stores: route, distance: totalDistance };
}

// Check autonomy eligibility based on worker performance
function checkAutonomyEligibility(worker: Worker): { eligible: boolean; blocks: string[] } {
  const blocks: string[] = [];
  
  // Hard blocks
  if (worker.autonomy_level === 'manual_only') {
    blocks.push('Worker is set to manual-only mode');
  }
  
  if (worker.trend_direction === 'declining') {
    blocks.push('Worker has declining performance trend');
  }
  
  if (worker.has_sla_breaches) {
    blocks.push('Worker has recent SLA breaches');
  }
  
  if (worker.has_critical_exceptions) {
    blocks.push('Worker has unresolved critical exceptions');
  }
  
  if (worker.reliability_score < 60) {
    blocks.push(`Reliability score below threshold (${worker.reliability_score}%)`);
  }
  
  if (worker.trust_score < 50) {
    blocks.push(`Trust score below threshold (${worker.trust_score}%)`);
  }
  
  return {
    eligible: blocks.length === 0 && worker.autonomy_level !== 'manual_only',
    blocks
  };
}

// Calculate risk level for a route
function calculateRiskLevel(route: OptimizedRoute, worker: Worker): 'low' | 'medium' | 'high' {
  let riskScore = 0;
  
  // High urgency stops increase risk
  const highUrgencyStops = route.stores.filter(s => s.urgency >= 80).length;
  riskScore += highUrgencyStops * 10;
  
  // Long routes increase risk
  if (route.stores.length > 12) riskScore += 15;
  if (route.distance > 50) riskScore += 20;
  
  // Worker performance affects risk
  if (worker.reliability_score < 70) riskScore += 15;
  if (worker.trust_score < 60) riskScore += 10;
  if (worker.trend_direction === 'declining') riskScore += 20;
  
  if (riskScore >= 40) return 'high';
  if (riskScore >= 20) return 'medium';
  return 'low';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      date, 
      territory, 
      mode = 'balanced',
      vehicle_type,
      store_ids,
      max_stops_per_route = 15,
      max_duration_minutes = 240
    } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Stage 1: Fetch stores that need visits
    let storeQuery = supabase
      .from('stores')
      .select(`
        id, name, lat, lng, type, 
        store_product_state(urgency_score)
      `)
      .eq('status', 'active')
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    if (territory && territory !== '__all__') {
      storeQuery = storeQuery.contains('tags', [territory]);
    }
    
    if (store_ids && store_ids.length > 0) {
      storeQuery = storeQuery.in('id', store_ids);
    }

    const { data: stores, error: storesError } = await storeQuery;
    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    if (!stores || stores.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          routes_created: 0, 
          routes: [],
          message: 'No stores found matching criteria'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform stores with urgency
    const storesWithUrgency: Store[] = stores.map(store => ({
      id: store.id,
      name: store.name,
      lat: store.lat,
      lng: store.lng,
      urgency: (store.store_product_state as any)?.[0]?.urgency_score || 0
    })).filter(s => s.urgency > 20); // Only include stores needing attention

    if (storesWithUrgency.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          routes_created: 0, 
          routes: [],
          message: 'No stores with urgency scores above threshold'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stage 2: Fetch available workers with performance data
    let workerQuery = supabase
      .from('profiles')
      .select(`
        id, name, role,
        worker_performance(
          trust_score, 
          reliability_score, 
          autonomy_level, 
          trend_direction,
          has_sla_breaches,
          has_critical_exceptions
        )
      `);
    
    if (vehicle_type && vehicle_type !== '__all__') {
      workerQuery = workerQuery.eq('role', vehicle_type);
    } else {
      workerQuery = workerQuery.in('role', ['driver', 'biker']);
    }

    const { data: workersRaw, error: workersError } = await workerQuery.limit(20);
    if (workersError) {
      throw new Error(`Failed to fetch workers: ${workersError.message}`);
    }

    if (!workersRaw || workersRaw.length === 0) {
      throw new Error('No workers available for assignment');
    }

    // Transform workers with performance data
    const workers: Worker[] = workersRaw.map(w => {
      const perf = (w.worker_performance as any)?.[0] || {};
      return {
        id: w.id,
        name: w.name || 'Unknown',
        role: w.role || 'driver',
        trust_score: perf.trust_score ?? 75,
        reliability_score: perf.reliability_score ?? 75,
        autonomy_level: perf.autonomy_level ?? 'assisted',
        trend_direction: perf.trend_direction ?? 'stable',
        has_sla_breaches: perf.has_sla_breaches ?? false,
        has_critical_exceptions: perf.has_critical_exceptions ?? false
      };
    });

    // Sort workers by reliability (best workers first for hardest routes)
    workers.sort((a, b) => b.reliability_score - a.reliability_score);

    // Stage 3: Cluster stores into route groups
    const targetStopsPerRoute = Math.min(max_stops_per_route, Math.max(6, Math.ceil(storesWithUrgency.length / workers.length)));
    
    // Sort stores by urgency for initial clustering
    storesWithUrgency.sort((a, b) => b.urgency - a.urgency);
    
    const routeProposals: RouteProposal[] = [];
    let storeIndex = 0;

    for (let i = 0; i < workers.length && storeIndex < storesWithUrgency.length; i++) {
      const worker = workers[i];
      const endIdx = Math.min(storeIndex + targetStopsPerRoute, storesWithUrgency.length);
      const routeStores = storesWithUrgency.slice(storeIndex, endIdx);
      storeIndex = endIdx;

      if (routeStores.length === 0) continue;

      // Stage 4: Optimize route based on selected mode
      let optimized: OptimizedRoute;
      switch (mode) {
        case 'fastest':
        case 'shortest':
          optimized = optimizeRouteByDistance(routeStores);
          break;
        case 'priority':
          optimized = optimizeRouteByPriority(routeStores);
          break;
        case 'balanced':
        default:
          optimized = optimizeRouteBalanced(routeStores);
          break;
      }

      // Stage 5: Check autonomy eligibility
      const autonomyCheck = checkAutonomyEligibility(worker);
      
      // Stage 6: Calculate risk level
      const riskLevel = calculateRiskLevel(optimized, worker);
      
      // Calculate metrics
      const estimatedDuration = Math.round(optimized.distance * 4 + routeStores.length * 15);
      const estimatedProfit = routeStores.reduce((sum, s) => sum + (s.urgency * 5), 0);
      const optimizationScore = Math.round(
        Math.min(100, Math.max(0,
          (routeStores.length * 5) + 
          (100 - optimized.distance) + 
          (estimatedProfit / 20) +
          (autonomyCheck.eligible ? 10 : 0) -
          (riskLevel === 'high' ? 15 : riskLevel === 'medium' ? 5 : 0)
        ))
      );

      // Skip if route would exceed duration limit
      if (estimatedDuration > max_duration_minutes) {
        continue;
      }

      // Stage 7: Create route in database
      const { data: newRoute, error: routeError } = await supabase
        .from('routes')
        .insert({
          date: date || new Date().toISOString().split('T')[0],
          type: worker.role,
          territory: territory && territory !== '__all__' ? territory : 'Multi-Zone',
          assigned_to: worker.id,
          status: 'draft', // Start as draft until approved
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

      // Stage 8: Create route stops
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
        // Rollback route if stops fail
        await supabase.from('routes').delete().eq('id', newRoute.id);
        continue;
      }

      // Build proposal response
      routeProposals.push({
        id: newRoute.id,
        driver: worker.name,
        driver_id: worker.id,
        role: worker.role,
        stops: optimized.stores.length,
        distance: Math.round(optimized.distance * 10) / 10,
        duration: estimatedDuration,
        profit: Math.round(estimatedProfit),
        score: optimizationScore,
        territory: territory && territory !== '__all__' ? territory : 'Multi-Zone',
        stores: optimized.stores,
        autonomy_eligible: autonomyCheck.eligible,
        guardrail_blocks: autonomyCheck.blocks,
        risk_level: riskLevel
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        routes_created: routeProposals.length,
        routes: routeProposals,
        stats: {
          total_stores_processed: storesWithUrgency.length,
          workers_available: workers.length,
          mode_used: mode,
          territory: territory || 'all'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Optimization error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown optimization error',
        stage: 'optimization_engine',
        details: String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
