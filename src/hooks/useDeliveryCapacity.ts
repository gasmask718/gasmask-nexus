import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { format, addDays } from "date-fns";

export interface TerritoryCapacity {
  territory: string;
  drivers: number;
  bikers: number;
  ambassadors: number;
  totalWorkers: number;
  activeRoutes: number;
  totalStops: number;
  avgStopsPerWorker: number;
  utilizationPercent: number;
  status: 'underutilized' | 'balanced' | 'overloaded';
  dailyCapacity: number;
  currentLoad: number;
  remainingCapacity: number;
  hiringRecommendation?: string;
}

export interface WorkerLoad {
  id: string;
  name: string;
  role: 'driver' | 'biker' | 'ambassador';
  territory?: string;
  assignedRoutes: number;
  stopsAssigned: number;
  estimatedMinutes: number;
  utilizationPercent: number;
  slaRisk: 'low' | 'medium' | 'high';
  isOverloaded: boolean;
  isIdle: boolean;
}

export interface CapacityAlert {
  id: string;
  type: 'overload' | 'shortfall' | 'idle' | 'sla_risk';
  severity: 'warning' | 'critical';
  territory: string;
  message: string;
  recommendation: string;
  affectedWorkers?: number;
}

// Optimal stops per worker by role (configurable)
const OPTIMAL_STOPS = {
  driver: 25,
  biker: 15,
  ambassador: 10,
};

const AVG_MINUTES_PER_STOP = 8;

export function useDeliveryCapacity(selectedDate: Date, selectedTerritory?: string) {
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
  const isTomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd') === dateStr;

  // Fetch capacity metrics
  const { data: capacityMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['delivery-capacity-metrics', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_capacity_metrics')
        .select('*')
        .order('city');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch active routes for the selected date
  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['delivery-routes-capacity', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, status, territory, estimated_duration_minutes, assigned_to')
        .gte('date', dateStr)
        .lt('date', format(addDays(selectedDate, 1), 'yyyy-MM-dd'));

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch route stops to count per route
  const { data: routeStops, isLoading: stopsLoading } = useQuery({
    queryKey: ['delivery-route-stops-capacity', dateStr],
    queryFn: async () => {
      if (!routes || routes.length === 0) return [];
      
      const routeIds = routes.map(r => r.id);
      const { data, error } = await supabase
        .from('route_stops')
        .select('id, route_id')
        .in('route_id', routeIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!routes && routes.length > 0,
  });

  // Fetch driver/biker profiles for worker data
  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ['workers-capacity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('role', ['driver', 'biker', 'ambassador']);

      if (error) throw error;
      return data || [];
    },
  });

  // Create a map of route_id -> stop count
  const stopsPerRoute = useMemo(() => {
    const map = new Map<string, number>();
    routeStops?.forEach(stop => {
      if (stop.route_id) {
        map.set(stop.route_id, (map.get(stop.route_id) || 0) + 1);
      }
    });
    return map;
  }, [routeStops]);

  // Transform capacity metrics to territory data
  const territoryCapacity = useMemo<TerritoryCapacity[]>(() => {
    if (!capacityMetrics) return [];

    return capacityMetrics
      .filter(m => !selectedTerritory || m.city === selectedTerritory)
      .map(metric => {
        const totalWorkers = (metric.driver_count || 0) + (metric.biker_count || 0);
        const routesInTerritory = routes?.filter(r => r.territory === metric.city) || [];
        const activeRoutes = routesInTerritory.length;
        const totalStops = routesInTerritory.reduce((sum, r) => sum + (stopsPerRoute.get(r.id) || 0), 0);
        const avgStopsPerWorker = totalWorkers > 0 ? totalStops / totalWorkers : 0;
        const utilizationPercent = metric.utilization_rate || 0;
        const remainingCapacity = (metric.daily_capacity || 0) - (metric.current_load || 0);

        let status: TerritoryCapacity['status'] = 'balanced';
        if (utilizationPercent < 50) status = 'underutilized';
        else if (utilizationPercent > 100) status = 'overloaded';

        return {
          territory: metric.city,
          drivers: metric.driver_count || 0,
          bikers: metric.biker_count || 0,
          ambassadors: 0, // Could be added to schema
          totalWorkers,
          activeRoutes,
          totalStops,
          avgStopsPerWorker: Math.round(avgStopsPerWorker * 10) / 10,
          utilizationPercent: Math.round(utilizationPercent),
          status,
          dailyCapacity: metric.daily_capacity || 0,
          currentLoad: metric.current_load || 0,
          remainingCapacity,
          hiringRecommendation: metric.hiring_recommendation || undefined,
        };
      });
  }, [capacityMetrics, routes, stopsPerRoute, selectedTerritory]);

  // Generate worker load data
  const workerLoads = useMemo<WorkerLoad[]>(() => {
    if (!workers || !routes) return [];

    return workers
      .filter(w => !selectedTerritory) // Would need territory assignment in profiles
      .map(worker => {
        const workerRoutes = routes.filter(r => r.assigned_to === worker.id);
        const stopsAssigned = workerRoutes.reduce((sum, r) => sum + (stopsPerRoute.get(r.id) || 0), 0);
        const estimatedMinutes = stopsAssigned * AVG_MINUTES_PER_STOP;
        const role = (worker.role as 'driver' | 'biker' | 'ambassador') || 'driver';
        const optimalStops = OPTIMAL_STOPS[role] || 20;
        const utilizationPercent = (stopsAssigned / optimalStops) * 100;

        let slaRisk: WorkerLoad['slaRisk'] = 'low';
        if (utilizationPercent > 120) slaRisk = 'high';
        else if (utilizationPercent > 90) slaRisk = 'medium';

        return {
          id: worker.id,
          name: worker.name || 'Unknown',
          role,
          assignedRoutes: workerRoutes.length,
          stopsAssigned,
          estimatedMinutes,
          utilizationPercent: Math.round(utilizationPercent),
          slaRisk,
          isOverloaded: utilizationPercent > 100,
          isIdle: stopsAssigned === 0,
        };
      });
  }, [workers, routes, stopsPerRoute, selectedTerritory]);

  // Generate capacity alerts
  const alerts = useMemo<CapacityAlert[]>(() => {
    const result: CapacityAlert[] = [];

    // Territory overload alerts
    territoryCapacity.forEach(t => {
      if (t.status === 'overloaded') {
        const overloadPct = t.utilizationPercent - 100;
        result.push({
          id: `overload-${t.territory}`,
          type: 'overload',
          severity: overloadPct > 25 ? 'critical' : 'warning',
          territory: t.territory,
          message: `${t.territory} overloaded by ${overloadPct}%`,
          recommendation: t.hiringRecommendation || `Add ${Math.ceil(overloadPct / 20)} workers to prevent SLA breach`,
        });
      }
    });

    // Worker overload alerts
    const overloadedWorkers = workerLoads.filter(w => w.isOverloaded);
    if (overloadedWorkers.length > 0) {
      result.push({
        id: 'workers-overloaded',
        type: 'overload',
        severity: overloadedWorkers.length > 3 ? 'critical' : 'warning',
        territory: 'All',
        message: `${overloadedWorkers.length} workers exceed optimal stop count`,
        recommendation: 'Redistribute stops or add support workers',
        affectedWorkers: overloadedWorkers.length,
      });
    }

    // Idle capacity alerts
    const idleWorkers = workerLoads.filter(w => w.isIdle);
    if (idleWorkers.length > 2) {
      result.push({
        id: 'idle-capacity',
        type: 'idle',
        severity: 'warning',
        territory: 'All',
        message: `${idleWorkers.length} workers have no assignments`,
        recommendation: 'Assign routes or reallocate to high-demand territories',
        affectedWorkers: idleWorkers.length,
      });
    }

    // Tomorrow shortfall prediction
    if (isTomorrow) {
      const underCapacity = territoryCapacity.filter(t => t.remainingCapacity < 0);
      underCapacity.forEach(t => {
        result.push({
          id: `shortfall-${t.territory}`,
          type: 'shortfall',
          severity: 'critical',
          territory: t.territory,
          message: `Tomorrow AM capacity shortfall in ${t.territory}`,
          recommendation: `Need ${Math.abs(t.remainingCapacity)} more stops capacity`,
        });
      });
    }

    return result;
  }, [territoryCapacity, workerLoads, isTomorrow]);

  // Summary KPIs
  const summary = useMemo(() => {
    const totalDrivers = territoryCapacity.reduce((sum, t) => sum + t.drivers, 0);
    const totalBikers = territoryCapacity.reduce((sum, t) => sum + t.bikers, 0);
    const totalAmbassadors = territoryCapacity.reduce((sum, t) => sum + t.ambassadors, 0);
    const totalWorkers = totalDrivers + totalBikers + totalAmbassadors;
    const totalRoutes = territoryCapacity.reduce((sum, t) => sum + t.activeRoutes, 0);
    const totalStops = territoryCapacity.reduce((sum, t) => sum + t.totalStops, 0);
    const avgStopsPerWorker = totalWorkers > 0 ? totalStops / totalWorkers : 0;
    const totalCapacity = territoryCapacity.reduce((sum, t) => sum + t.dailyCapacity, 0);
    const totalLoad = territoryCapacity.reduce((sum, t) => sum + t.currentLoad, 0);
    const utilizationPercent = totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0;

    return {
      totalWorkers,
      totalDrivers,
      totalBikers,
      totalAmbassadors,
      totalRoutes,
      totalStops,
      avgStopsPerWorker: Math.round(avgStopsPerWorker * 10) / 10,
      utilizationPercent: Math.round(utilizationPercent),
    };
  }, [territoryCapacity]);

  const territories = useMemo(() => {
    return [...new Set(capacityMetrics?.map(m => m.city) || [])].sort();
  }, [capacityMetrics]);

  return {
    summary,
    territoryCapacity,
    workerLoads,
    alerts,
    territories,
    isLoading: metricsLoading || routesLoading || stopsLoading || workersLoading,
    isToday,
    isTomorrow,
  };
}
