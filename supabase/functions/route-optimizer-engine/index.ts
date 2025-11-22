import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { targetDate } = await req.json();
    const planDate = targetDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]; // tomorrow by default

    console.log(`[Route Optimizer] Running for date: ${planDate}`);

    // Fetch active drivers
    const { data: drivers, error: driversError } = await supabase
      .from('profiles')
      .select('id, name, role, driver_health_score')
      .in('role', ['driver', 'biker'])
      .eq('status', 'active')
      .order('driver_health_score', { ascending: false });

    if (driversError) throw driversError;
    if (!drivers || drivers.length === 0) {
      throw new Error('No active drivers found');
    }

    console.log(`[Route Optimizer] Found ${drivers.length} active drivers`);

    // Fetch active stores
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name, lat, lng, last_visit_date, visit_frequency_target, visit_risk_level, performance_score')
      .eq('status', 'active')
      .order('visit_risk_level', { ascending: false });

    if (storesError) throw storesError;
    if (!stores || stores.length === 0) {
      throw new Error('No active stores found');
    }

    console.log(`[Route Optimizer] Found ${stores.length} active stores`);

    // Calculate coverage and update store risk levels
    const today = new Date();
    const storesNeedingVisit: Array<any> = [];
    const updatesNeeded: Array<{ id: string; visit_risk_level: string }> = [];

    for (const store of stores) {
      const lastVisit = store.last_visit_date ? new Date(store.last_visit_date) : null;
      const daysSinceVisit = lastVisit ? Math.floor((today.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      const target = store.visit_frequency_target || 7;

      let newRiskLevel = 'normal';
      let needsVisit = false;

      if (daysSinceVisit > target * 2) {
        newRiskLevel = 'critical';
        needsVisit = true;
      } else if (daysSinceVisit > target) {
        newRiskLevel = 'at_risk';
        needsVisit = true;
      } else if (store.performance_score && store.performance_score > 70) {
        needsVisit = true; // High performers always get visits
      }

      if (newRiskLevel !== store.visit_risk_level) {
        updatesNeeded.push({
          id: store.id,
          visit_risk_level: newRiskLevel,
        });
      }

      if (needsVisit) {
        storesNeedingVisit.push({
          ...store,
          daysSinceVisit,
          priority: newRiskLevel === 'critical' ? 3 : newRiskLevel === 'at_risk' ? 2 : 1,
        });
      }
    }

    // Update store risk levels
    for (const update of updatesNeeded) {
      await supabase
        .from('stores')
        .update({ visit_risk_level: update.visit_risk_level })
        .eq('id', update.id);
    }

    console.log(`[Route Optimizer] ${storesNeedingVisit.length} stores need visits`);

    // Sort stores by priority and group by region
    storesNeedingVisit.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return 0; // Keep original order
    });

    // Distribute stores to drivers
    const storesPerDriver = Math.ceil(storesNeedingVisit.length / drivers.length);
    const driverRoutes: any = {};

    drivers.forEach((driver, index) => {
      const startIdx = index * storesPerDriver;
      const endIdx = Math.min(startIdx + storesPerDriver, storesNeedingVisit.length);
      driverRoutes[driver.id] = storesNeedingVisit.slice(startIdx, endIdx);
    });

    // Create routes
    let routesCreated = 0;
    let atRiskCovered = 0;
    let criticalCovered = 0;

    for (const [driverId, storeList] of Object.entries(driverRoutes)) {
      if (!Array.isArray(storeList) || storeList.length === 0) continue;

      const storeIds = storeList.map((s: any) => s.id);
      atRiskCovered += storeList.filter((s: any) => s.visit_risk_level === 'at_risk').length;
      criticalCovered += storeList.filter((s: any) => s.visit_risk_level === 'critical').length;

      // Calculate estimated distance (rough approximation)
      const estimatedDistanceKm = storeList.length * 5; // 5km per stop average
      const estimatedDurationMinutes = storeList.length * 30; // 30min per stop average

      // Calculate optimization score
      const balanceScore = Math.min(100, (storeList.length / storesPerDriver) * 100);
      const riskCoverageScore = ((atRiskCovered + criticalCovered * 2) / Math.max(1, storesNeedingVisit.length)) * 100;
      const optimizationScore = Math.round((balanceScore + riskCoverageScore) / 2);

      // Check if route already exists
      const { data: existingRoute } = await supabase
        .from('routes_generated')
        .select('id')
        .eq('assigned_to', driverId)
        .eq('date', planDate)
        .maybeSingle();

      if (existingRoute) {
        // Update existing route
        await supabase
          .from('routes_generated')
          .update({
            store_ids: storeIds,
            optimization_score: optimizationScore,
            estimated_distance_km: estimatedDistanceKm,
            estimated_duration_minutes: estimatedDurationMinutes,
          })
          .eq('id', existingRoute.id);
      } else {
        // Create new route
        await supabase
          .from('routes_generated')
          .insert({
            date: planDate,
            assigned_to: driverId,
            store_ids: storeIds,
            status: 'pending',
            optimization_score: optimizationScore,
            estimated_distance_km: estimatedDistanceKm,
            estimated_duration_minutes: estimatedDurationMinutes,
          });
      }

      routesCreated++;
    }

    // Compute route performance snapshots for yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    for (const driver of drivers) {
      // Get routes for yesterday
      const { data: routes } = await supabase
        .from('routes_generated')
        .select('id, store_ids')
        .eq('assigned_to', driver.id)
        .eq('date', yesterday);

      if (!routes || routes.length === 0) continue;

      const totalStops = routes.reduce((sum, r) => sum + (r.store_ids?.length || 0), 0);

      // Get completed checkins
      const { data: checkins } = await supabase
        .from('route_checkins')
        .select('id, store_id, status, checkin_time')
        .eq('driver_id', driver.id)
        .gte('checkin_time', `${yesterday}T00:00:00`)
        .lte('checkin_time', `${yesterday}T23:59:59`);

      const completedStops = checkins?.filter(c => c.status === 'completed').length || 0;
      const completionRate = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
      const missedStops = totalStops - (checkins?.length || 0);

      const efficiencyScore = Math.min(100, Math.round(completionRate * 1.2));
      const coverageScore = Math.min(100, Math.round((completedStops / Math.max(1, totalStops)) * 100));

      // Insert snapshot
      await supabase
        .from('route_performance_snapshots')
        .insert({
          date: yesterday,
          driver_id: driver.id,
          total_routes: routes.length,
          total_stops: totalStops,
          completed_stops: completedStops,
          completion_rate: completionRate,
          missed_stops_count: missedStops,
          efficiency_score: efficiencyScore,
          coverage_score: coverageScore,
        });
    }

    // Update AI system health
    const avgEfficiency = drivers.length > 0 
      ? Math.round(drivers.reduce((sum, d) => sum + (d.driver_health_score || 50), 0) / drivers.length)
      : 50;

    await supabase
      .from('ai_system_health')
      .insert({
        overall_health_score: avgEfficiency,
        routes_efficiency_score: avgEfficiency,
        insights: {
          routeAlerts: [
            `${criticalCovered} critical stores covered`,
            `${atRiskCovered} at-risk stores covered`,
            `${routesCreated} routes optimized for ${planDate}`,
          ],
        },
      });

    console.log(`[Route Optimizer] Success: ${routesCreated} routes created`);

    return new Response(
      JSON.stringify({
        success: true,
        datePlanned: planDate,
        driversProcessed: drivers.length,
        routesCreated,
        atRiskStoresCovered: atRiskCovered,
        criticalStoresCovered: criticalCovered,
        summary: {
          totalStoresNeedingVisit: storesNeedingVisit.length,
          avgStopsPerDriver: Math.round(storesNeedingVisit.length / drivers.length),
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Route Optimizer] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
