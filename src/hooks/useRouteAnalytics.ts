// ═══════════════════════════════════════════════════════════════════════════════
// POST-ROUTE ANALYTICS ENGINE — Floor 4 Phase 3
// Computes route performance after completion and updates worker metrics
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RouteAnalytics {
  id: string;
  route_id: string;
  worker_id: string;
  planned_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  duration_variance_minutes: number | null;
  planned_distance_km: number | null;
  actual_distance_km: number | null;
  distance_variance_km: number | null;
  planned_stops: number | null;
  completed_stops: number | null;
  skipped_stops: number | null;
  failed_stops: number | null;
  avg_stop_time_minutes: number | null;
  max_stop_time_minutes: number | null;
  min_stop_time_minutes: number | null;
  on_time_stops: number;
  late_stops: number;
  early_stops: number;
  total_exceptions: number;
  critical_exceptions: number;
  exception_density: number;
  delivery_success_rate: number;
  pod_capture_rate: number;
  performance_score: number | null;
  route_grade: string | null;
  route_started_at: string | null;
  route_completed_at: string | null;
  computed_at: string;
}

export interface WorkerPerformance {
  id: string;
  worker_id: string;
  routes_completed_7d: number;
  routes_completed_30d: number;
  routes_completed_90d: number;
  stops_completed_7d: number;
  stops_completed_30d: number;
  stops_completed_90d: number;
  avg_stop_time_minutes: number;
  avg_route_duration_minutes: number;
  on_time_rate: number;
  completion_rate: number;
  exception_rate: number;
  reliability_score: number;
  trust_score: number;
  consistency_score: number;
  autonomy_level: 'manual_only' | 'assisted' | 'auto_eligible';
  autonomy_promoted_at: string | null;
  trend_direction: 'improving' | 'stable' | 'declining';
  trend_updated_at: string;
  requires_training: boolean;
  training_notes: string | null;
  last_coaching_at: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch analytics for a specific route
export function useRouteAnalytics(routeId: string) {
  return useQuery({
    queryKey: ['route-analytics', routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_analytics')
        .select('*')
        .eq('route_id', routeId)
        .maybeSingle();
      
      if (error) throw error;
      return data as RouteAnalytics | null;
    },
    enabled: !!routeId,
  });
}

// Fetch all route analytics with filters
export function useAllRouteAnalytics(options?: { 
  workerId?: string; 
  days?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['all-route-analytics', options],
    queryFn: async () => {
      let query = supabase
        .from('route_analytics')
        .select(`
          *,
          route:routes(id, date, territory, type),
          worker:profiles!route_analytics_worker_id_fkey(id, name, role)
        `)
        .order('computed_at', { ascending: false });
      
      if (options?.workerId) {
        query = query.eq('worker_id', options.workerId);
      }
      
      if (options?.days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - options.days);
        query = query.gte('computed_at', startDate.toISOString());
      }
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Fetch worker performance profile
export function useWorkerPerformance(workerId: string) {
  return useQuery({
    queryKey: ['worker-performance', workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_performance')
        .select('*')
        .eq('worker_id', workerId)
        .maybeSingle();
      
      if (error) throw error;
      return data as WorkerPerformance | null;
    },
    enabled: !!workerId,
  });
}

// Fetch all workers with performance data
export function useAllWorkerPerformance() {
  return useQuery({
    queryKey: ['all-worker-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_performance')
        .select(`
          *,
          worker:profiles!worker_performance_worker_id_fkey(id, name, role, phone, avatar_url)
        `)
        .order('trust_score', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

// Compute and save route analytics after completion
export function useComputeRouteAnalytics() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (routeId: string) => {
      // 1. Fetch route data
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();
      
      if (routeError) throw routeError;
      
      // 2. Fetch stops for this route
      const { data: stops, error: stopsError } = await supabase
        .from('route_stops')
        .select('*')
        .eq('route_id', routeId);
      
      if (stopsError) throw stopsError;
      
      // 3. Fetch deliveries for this route
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('route_id', routeId);
      
      if (deliveriesError) throw deliveriesError;
      
      // 4. Fetch exceptions for deliveries
      const deliveryIds = deliveries?.map(d => d.id) || [];
      let exceptions: any[] = [];
      if (deliveryIds.length > 0) {
        const { data: exData } = await supabase
          .from('delivery_exceptions')
          .select('*')
          .in('delivery_id', deliveryIds);
        exceptions = exData || [];
      }
      
      // 5. Compute metrics
      const plannedStops = stops?.length || 0;
      const completedStops = stops?.filter(s => s.status === 'completed').length || 0;
      const skippedStops = stops?.filter(s => s.status === 'skipped').length || 0;
      const failedStops = stops?.filter(s => s.status === 'failed').length || 0;
      
      // Time calculations
      const stopTimes = stops
        ?.filter(s => s.actual_arrival && s.actual_departure)
        .map(s => {
          const arrival = new Date(s.actual_arrival).getTime();
          const departure = new Date(s.actual_departure).getTime();
          return (departure - arrival) / (1000 * 60); // minutes
        }) || [];
      
      const avgStopTime = stopTimes.length > 0 
        ? stopTimes.reduce((a, b) => a + b, 0) / stopTimes.length 
        : 0;
      const maxStopTime = stopTimes.length > 0 ? Math.max(...stopTimes) : 0;
      const minStopTime = stopTimes.length > 0 ? Math.min(...stopTimes) : 0;
      
      // Duration calculation
      let actualDuration = 0;
      if (route.started_at && route.completed_at) {
        actualDuration = Math.round(
          (new Date(route.completed_at).getTime() - new Date(route.started_at).getTime()) / (1000 * 60)
        );
      }
      
      // Exception metrics
      const totalExceptions = exceptions.length;
      const criticalExceptions = exceptions.filter(e => e.severity === 'critical').length;
      const exceptionDensity = plannedStops > 0 ? totalExceptions / plannedStops : 0;
      
      // Delivery metrics
      const completedDeliveries = deliveries?.filter(d => d.status === 'completed').length || 0;
      const totalDeliveries = deliveries?.length || 1;
      const deliverySuccessRate = completedDeliveries / totalDeliveries;
      
      const podCaptured = deliveries?.filter(d => d.pod_captured_at).length || 0;
      const podCaptureRate = completedDeliveries > 0 ? podCaptured / completedDeliveries : 0;
      
      // Performance score calculation (0-100)
      let performanceScore = 100;
      
      // Deduct for incomplete stops
      if (plannedStops > 0) {
        performanceScore -= ((plannedStops - completedStops) / plannedStops) * 30;
      }
      
      // Deduct for exceptions
      performanceScore -= Math.min(totalExceptions * 5, 20);
      performanceScore -= criticalExceptions * 10;
      
      // Deduct for late delivery
      const lateStops = stops?.filter(s => s.was_on_time === false).length || 0;
      performanceScore -= lateStops * 3;
      
      // Bonus for POD capture
      performanceScore += podCaptureRate * 10;
      
      performanceScore = Math.max(0, Math.min(100, Math.round(performanceScore)));
      
      // Grade calculation
      const grade = 
        performanceScore >= 90 ? 'A' :
        performanceScore >= 80 ? 'B' :
        performanceScore >= 70 ? 'C' :
        performanceScore >= 60 ? 'D' : 'F';
      
      // 6. Insert/Update analytics record
      const analyticsData = {
        route_id: routeId,
        worker_id: route.assigned_to,
        planned_duration_minutes: route.estimated_duration_minutes,
        actual_duration_minutes: actualDuration,
        duration_variance_minutes: actualDuration - (route.estimated_duration_minutes || 0),
        planned_distance_km: route.estimated_distance_km,
        actual_distance_km: route.actual_distance_km,
        distance_variance_km: (route.actual_distance_km || 0) - (route.estimated_distance_km || 0),
        planned_stops: plannedStops,
        completed_stops: completedStops,
        skipped_stops: skippedStops,
        failed_stops: failedStops,
        avg_stop_time_minutes: avgStopTime,
        max_stop_time_minutes: maxStopTime,
        min_stop_time_minutes: minStopTime,
        on_time_stops: stops?.filter(s => s.was_on_time === true).length || 0,
        late_stops: lateStops,
        early_stops: 0, // Would need more data
        total_exceptions: totalExceptions,
        critical_exceptions: criticalExceptions,
        exception_density: exceptionDensity,
        delivery_success_rate: deliverySuccessRate,
        pod_capture_rate: podCaptureRate,
        performance_score: performanceScore,
        route_grade: grade,
        route_started_at: route.started_at,
        route_completed_at: route.completed_at,
        computed_at: new Date().toISOString(),
      };
      
      const { data: analytics, error: insertError } = await supabase
        .from('route_analytics')
        .upsert(analyticsData, { onConflict: 'route_id' })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      return analytics;
    },
    onSuccess: (_, routeId) => {
      queryClient.invalidateQueries({ queryKey: ['route-analytics', routeId] });
      queryClient.invalidateQueries({ queryKey: ['all-route-analytics'] });
      toast.success('Route analytics computed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to compute analytics: ${error.message}`);
    },
  });
}

// Update worker performance based on recent routes
export function useUpdateWorkerPerformance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (workerId: string) => {
      // Fetch recent analytics for this worker
      const now = new Date();
      const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const days90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: allAnalytics, error: analyticsError } = await supabase
        .from('route_analytics')
        .select('*')
        .eq('worker_id', workerId)
        .gte('computed_at', days90)
        .order('computed_at', { ascending: false });
      
      if (analyticsError) throw analyticsError;
      
      const analytics7d = allAnalytics?.filter(a => a.computed_at >= days7) || [];
      const analytics30d = allAnalytics?.filter(a => a.computed_at >= days30) || [];
      const analytics90d = allAnalytics || [];
      
      // Compute rolling stats
      const computeStats = (data: typeof analytics7d) => {
        if (data.length === 0) return { routes: 0, stops: 0, avgStopTime: 0, avgDuration: 0, successRate: 1, exceptionRate: 0 };
        
        const routes = data.length;
        const stops = data.reduce((acc, a) => acc + (a.completed_stops || 0), 0);
        const avgStopTime = data.reduce((acc, a) => acc + (a.avg_stop_time_minutes || 0), 0) / routes;
        const avgDuration = data.reduce((acc, a) => acc + (a.actual_duration_minutes || 0), 0) / routes;
        const successRate = data.reduce((acc, a) => acc + (a.delivery_success_rate || 0), 0) / routes;
        const exceptionRate = data.reduce((acc, a) => acc + (a.exception_density || 0), 0) / routes;
        
        return { routes, stops, avgStopTime, avgDuration, successRate, exceptionRate };
      };
      
      const stats7d = computeStats(analytics7d);
      const stats30d = computeStats(analytics30d);
      const stats90d = computeStats(analytics90d);
      
      // Compute scores
      const avgPerformance = analytics30d.length > 0
        ? analytics30d.reduce((acc, a) => acc + (a.performance_score || 0), 0) / analytics30d.length
        : 50;
      
      // Reliability score based on completion rate and consistency
      const reliabilityScore = Math.round(
        (stats30d.successRate * 100 * 0.6) + 
        ((1 - stats30d.exceptionRate) * 100 * 0.4)
      );
      
      // Trust score based on overall performance history
      const trustScore = Math.round(
        (avgPerformance * 0.5) +
        (reliabilityScore * 0.3) +
        (stats90d.routes > 10 ? 20 : stats90d.routes * 2)
      );
      
      // Consistency score based on variance in performance
      const performances = analytics30d.map(a => a.performance_score || 0);
      const avgP = performances.reduce((a, b) => a + b, 0) / (performances.length || 1);
      const variance = performances.reduce((acc, p) => acc + Math.pow(p - avgP, 2), 0) / (performances.length || 1);
      const consistencyScore = Math.max(0, Math.min(100, 100 - Math.sqrt(variance)));
      
      // Trend detection
      let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
      if (analytics7d.length >= 3 && analytics30d.length >= 3) {
        const avg7d = analytics7d.reduce((acc, a) => acc + (a.performance_score || 0), 0) / analytics7d.length;
        const avg30d = analytics30d.reduce((acc, a) => acc + (a.performance_score || 0), 0) / analytics30d.length;
        
        if (avg7d > avg30d + 5) trendDirection = 'improving';
        else if (avg7d < avg30d - 5) trendDirection = 'declining';
      }
      
      // Autonomy level determination
      let autonomyLevel: 'manual_only' | 'assisted' | 'auto_eligible' = 'manual_only';
      if (trustScore >= 80 && stats30d.routes >= 20 && reliabilityScore >= 85) {
        autonomyLevel = 'auto_eligible';
      } else if (trustScore >= 60 && stats30d.routes >= 10 && reliabilityScore >= 70) {
        autonomyLevel = 'assisted';
      }
      
      // Training flag
      const requiresTraining = trendDirection === 'declining' || reliabilityScore < 60;
      
      // Upsert worker performance
      const performanceData = {
        worker_id: workerId,
        routes_completed_7d: stats7d.routes,
        routes_completed_30d: stats30d.routes,
        routes_completed_90d: stats90d.routes,
        stops_completed_7d: stats7d.stops,
        stops_completed_30d: stats30d.stops,
        stops_completed_90d: stats90d.stops,
        avg_stop_time_minutes: stats30d.avgStopTime,
        avg_route_duration_minutes: stats30d.avgDuration,
        on_time_rate: 0.85, // Would need more data
        completion_rate: stats30d.successRate,
        exception_rate: stats30d.exceptionRate,
        reliability_score: reliabilityScore,
        trust_score: trustScore,
        consistency_score: Math.round(consistencyScore),
        autonomy_level: autonomyLevel,
        trend_direction: trendDirection,
        trend_updated_at: new Date().toISOString(),
        requires_training: requiresTraining,
        updated_at: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from('worker_performance')
        .upsert(performanceData, { onConflict: 'worker_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, workerId) => {
      queryClient.invalidateQueries({ queryKey: ['worker-performance', workerId] });
      queryClient.invalidateQueries({ queryKey: ['all-worker-performance'] });
      toast.success('Worker performance updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update performance: ${error.message}`);
    },
  });
}

// Get performance leaderboard
export function usePerformanceLeaderboard(limit = 10) {
  return useQuery({
    queryKey: ['performance-leaderboard', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_performance')
        .select(`
          *,
          worker:profiles!worker_performance_worker_id_fkey(id, name, role, avatar_url)
        `)
        .order('trust_score', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data;
    },
  });
}
