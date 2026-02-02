// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE PREDICTIVE INTELLIGENCE HOOKS — Phase 4 Floor 4
// ETA prediction, risk scoring, capacity intelligence for Live Map
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import type { LiveRoute, LiveStop, WorkerLocation } from "./useLiveMapData";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface StopPrediction {
  stopId: string;
  storeId: string;
  storeName: string;
  plannedOrder: number;
  predictedArrival: Date;
  predictedDeparture: Date;
  estimatedServiceMinutes: number;
  travelTimeFromPrevious: number;
  status: 'on_track' | 'at_risk' | 'likely_late';
  slaDeadline?: Date;
  slaDeltaMinutes: number; // positive = ahead, negative = late
  confidence: number;
}

export interface RoutePrediction {
  routeId: string;
  assigneeName: string;
  territory: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedCompletion: Date;
  estimatedRemainingMinutes: number;
  stopsAtRisk: number;
  stopsLikelyLate: number;
  stopPredictions: StopPrediction[];
  recommendations: RouteRecommendation[];
}

export interface RouteRecommendation {
  type: 'split_route' | 'reassign_stop' | 'add_support' | 'delay_low_priority';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  affectedStops?: string[];
}

export interface WorkerRisk {
  workerId: string;
  workerName: string;
  role: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  activeRouteId?: string;
}

export interface CapacitySummary {
  territory: string;
  date: string;
  totalRoutes: number;
  totalStops: number;
  activeWorkers: number;
  avgStopsPerWorker: number;
  utilizationPercent: number;
  overloadedRoutes: number;
  underutilizedWorkers: number;
  capacityStatus: 'balanced' | 'overloaded' | 'underutilized';
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const AVERAGE_SERVICE_TIME_MINUTES = 8;
const AVERAGE_TRAVEL_TIME_MINUTES = 6;
const DRIVER_SPEED_MULTIPLIER = 0.8;
const BIKER_SPEED_MULTIPLIER = 1.2;
const RISK_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 90,
};
const MAX_STOPS_PER_ROUTE = 25;
const OPTIMAL_STOPS_PER_WORKER = 15;

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateTravelTime(distanceKm: number, role: string): number {
  // Average speed: 25 km/h city driving
  const baseSpeed = 25;
  const multiplier = role === 'biker' ? BIKER_SPEED_MULTIPLIER : DRIVER_SPEED_MULTIPLIER;
  return (distanceKm / (baseSpeed * multiplier)) * 60; // minutes
}

function calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= RISK_THRESHOLDS.critical) return 'critical';
  if (score >= RISK_THRESHOLDS.high) return 'high';
  if (score >= RISK_THRESHOLDS.medium) return 'medium';
  return 'low';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETA PREDICTION
// ═══════════════════════════════════════════════════════════════════════════════

export function usePredictiveETA(route: LiveRoute | null): StopPrediction[] {
  return useMemo(() => {
    if (!route) return [];

    const predictions: StopPrediction[] = [];
    const now = new Date();
    const role = route.assignee?.role || route.type || 'driver';
    
    // Find the last completed stop to start from
    const completedStops = route.stops.filter(s => s.status === 'completed');
    const pendingStops = route.stops
      .filter(s => s.status !== 'completed' && s.status !== 'skipped')
      .sort((a, b) => a.planned_order - b.planned_order);
    
    let currentTime = now;
    let previousStop: LiveStop | null = completedStops.length > 0 
      ? completedStops[completedStops.length - 1] 
      : null;

    for (const stop of pendingStops) {
      let travelTime = AVERAGE_TRAVEL_TIME_MINUTES;
      
      // Calculate travel time based on distance
      if (previousStop?.store?.lat && previousStop?.store?.lng && 
          stop.store?.lat && stop.store?.lng) {
        const distance = haversineDistance(
          previousStop.store.lat, previousStop.store.lng,
          stop.store.lat, stop.store.lng
        );
        travelTime = estimateTravelTime(distance, role);
      }

      const predictedArrival = new Date(currentTime.getTime() + travelTime * 60000);
      const serviceTime = AVERAGE_SERVICE_TIME_MINUTES;
      const predictedDeparture = new Date(predictedArrival.getTime() + serviceTime * 60000);

      // Check SLA (assume 2 hour window from route start for simplicity)
      const routeStart = route.started_at ? new Date(route.started_at) : now;
      const slaDeadline = new Date(routeStart.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      const slaDeltaMinutes = (slaDeadline.getTime() - predictedArrival.getTime()) / 60000;

      let status: StopPrediction['status'] = 'on_track';
      if (slaDeltaMinutes < 0) status = 'likely_late';
      else if (slaDeltaMinutes < 15) status = 'at_risk';

      predictions.push({
        stopId: stop.id,
        storeId: stop.store_id,
        storeName: stop.store?.name || 'Unknown',
        plannedOrder: stop.planned_order,
        predictedArrival,
        predictedDeparture,
        estimatedServiceMinutes: serviceTime,
        travelTimeFromPrevious: Math.round(travelTime),
        status,
        slaDeadline,
        slaDeltaMinutes: Math.round(slaDeltaMinutes),
        confidence: stop.planned_order <= 3 ? 0.9 : stop.planned_order <= 6 ? 0.75 : 0.6,
      });

      currentTime = predictedDeparture;
      previousStop = stop;
    }

    return predictions;
  }, [route]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE RISK SCORING
// ═══════════════════════════════════════════════════════════════════════════════

export function useRoutePredictions(
  routes: LiveRoute[],
  alerts: { route_id: string | null; severity: string }[]
): RoutePrediction[] {
  return useMemo(() => {
    return routes.map(route => {
      // Calculate ETA predictions for stops
      const stopPredictions: StopPrediction[] = [];
      const now = new Date();
      const role = route.assignee?.role || route.type || 'driver';
      
      const pendingStops = route.stops
        .filter(s => s.status !== 'completed' && s.status !== 'skipped')
        .sort((a, b) => a.planned_order - b.planned_order);
      
      let currentTime = now;
      let previousStop: LiveStop | null = null;

      for (const stop of pendingStops) {
        let travelTime = AVERAGE_TRAVEL_TIME_MINUTES;
        
        if (previousStop?.store?.lat && previousStop?.store?.lng && 
            stop.store?.lat && stop.store?.lng) {
          const distance = haversineDistance(
            previousStop.store.lat, previousStop.store.lng,
            stop.store.lat, stop.store.lng
          );
          travelTime = estimateTravelTime(distance, role);
        }

        const predictedArrival = new Date(currentTime.getTime() + travelTime * 60000);
        const serviceTime = AVERAGE_SERVICE_TIME_MINUTES;
        const predictedDeparture = new Date(predictedArrival.getTime() + serviceTime * 60000);

        const routeStart = route.started_at ? new Date(route.started_at) : now;
        const slaDeadline = new Date(routeStart.getTime() + 2 * 60 * 60 * 1000);
        const slaDeltaMinutes = (slaDeadline.getTime() - predictedArrival.getTime()) / 60000;

        let status: StopPrediction['status'] = 'on_track';
        if (slaDeltaMinutes < 0) status = 'likely_late';
        else if (slaDeltaMinutes < 15) status = 'at_risk';

        stopPredictions.push({
          stopId: stop.id,
          storeId: stop.store_id,
          storeName: stop.store?.name || 'Unknown',
          plannedOrder: stop.planned_order,
          predictedArrival,
          predictedDeparture,
          estimatedServiceMinutes: serviceTime,
          travelTimeFromPrevious: Math.round(travelTime),
          status,
          slaDeadline,
          slaDeltaMinutes: Math.round(slaDeltaMinutes),
          confidence: stop.planned_order <= 3 ? 0.9 : 0.6,
        });

        currentTime = predictedDeparture;
        previousStop = stop;
      }

      // Calculate risk score (0-100)
      let riskScore = 0;
      
      // Factor 1: SLA proximity (30 points max)
      const stopsAtRisk = stopPredictions.filter(s => s.status === 'at_risk').length;
      const stopsLikelyLate = stopPredictions.filter(s => s.status === 'likely_late').length;
      riskScore += stopsAtRisk * 5;
      riskScore += stopsLikelyLate * 10;
      
      // Factor 2: Stop density (20 points max)
      if (route.totalStops > MAX_STOPS_PER_ROUTE) {
        riskScore += 20;
      } else if (route.totalStops > OPTIMAL_STOPS_PER_WORKER) {
        riskScore += 10;
      }
      
      // Factor 3: Exception frequency (25 points max)
      const routeAlerts = alerts.filter(a => a.route_id === route.id);
      const criticalAlerts = routeAlerts.filter(a => a.severity === 'critical').length;
      const highAlerts = routeAlerts.filter(a => a.severity === 'high').length;
      riskScore += criticalAlerts * 15;
      riskScore += highAlerts * 10;
      
      // Factor 4: Progress lag (25 points max)
      const expectedProgress = route.started_at 
        ? (Date.now() - new Date(route.started_at).getTime()) / (route.estimated_duration_minutes || 120) / 60000 * 100
        : 0;
      const progressLag = expectedProgress - route.progressPercent;
      if (progressLag > 30) riskScore += 25;
      else if (progressLag > 15) riskScore += 15;
      else if (progressLag > 5) riskScore += 5;

      riskScore = Math.min(100, riskScore);

      // Generate recommendations
      const recommendations: RouteRecommendation[] = [];
      
      if (route.totalStops > MAX_STOPS_PER_ROUTE) {
        recommendations.push({
          type: 'split_route',
          priority: 'high',
          title: 'Split Route',
          description: `Route has ${route.totalStops} stops, exceeding optimal capacity. Consider splitting.`,
        });
      }
      
      if (stopsLikelyLate > 0) {
        recommendations.push({
          type: 'add_support',
          priority: 'high',
          title: 'Add Biker Support',
          description: `${stopsLikelyLate} stops are likely to be late. Consider adding support worker.`,
        });
      }
      
      if (stopsAtRisk > 3) {
        recommendations.push({
          type: 'delay_low_priority',
          priority: 'medium',
          title: 'Delay Low Priority Stops',
          description: 'Consider rescheduling non-urgent stops to focus on SLA-critical deliveries.',
        });
      }

      const lastStop = stopPredictions[stopPredictions.length - 1];
      const predictedCompletion = lastStop?.predictedDeparture || now;
      const estimatedRemainingMinutes = (predictedCompletion.getTime() - now.getTime()) / 60000;

      return {
        routeId: route.id,
        assigneeName: route.assignee?.name || 'Unassigned',
        territory: route.territory || 'Multi-Zone',
        riskScore,
        riskLevel: calculateRiskLevel(riskScore),
        predictedCompletion,
        estimatedRemainingMinutes: Math.round(estimatedRemainingMinutes),
        stopsAtRisk,
        stopsLikelyLate,
        stopPredictions,
        recommendations,
      };
    });
  }, [routes, alerts]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER RISK SCORING
// ═══════════════════════════════════════════════════════════════════════════════

export function useWorkerRiskScoring(
  workers: WorkerLocation[],
  routes: LiveRoute[]
): WorkerRisk[] {
  return useMemo(() => {
    return workers.map(worker => {
      const factors: string[] = [];
      let riskScore = 0;

      // Find worker's active route
      const activeRoute = routes.find(r => r.assigned_to === worker.worker_id);

      // Factor 1: GPS staleness
      const lastUpdate = new Date(worker.updated_at);
      const staleMinutes = (Date.now() - lastUpdate.getTime()) / 60000;
      if (staleMinutes > 15) {
        riskScore += 30;
        factors.push(`GPS stale (${Math.round(staleMinutes)}m)`);
      } else if (staleMinutes > 5) {
        riskScore += 15;
        factors.push(`GPS delayed (${Math.round(staleMinutes)}m)`);
      }

      // Factor 2: Route progress
      if (activeRoute) {
        const progressLag = 50 - activeRoute.progressPercent; // Assume 50% expected
        if (progressLag > 20) {
          riskScore += 25;
          factors.push('Behind schedule');
        }

        // Factor 3: Alert count
        if (activeRoute.alertCount > 0) {
          riskScore += activeRoute.alertCount * 10;
          factors.push(`${activeRoute.alertCount} open alerts`);
        }

        // Factor 4: Stop density
        if (activeRoute.totalStops > OPTIMAL_STOPS_PER_WORKER) {
          riskScore += 15;
          factors.push('High stop count');
        }
      }

      riskScore = Math.min(100, riskScore);

      return {
        workerId: worker.worker_id,
        workerName: worker.name,
        role: worker.role,
        riskScore,
        riskLevel: calculateRiskLevel(riskScore) as 'low' | 'medium' | 'high',
        factors,
        activeRouteId: activeRoute?.id,
      };
    });
  }, [workers, routes]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPACITY INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

export function useCapacityIntelligence(
  routes: LiveRoute[],
  workers: WorkerLocation[],
  selectedTerritory?: string,
  selectedDate?: string
): CapacitySummary[] {
  return useMemo(() => {
    // Group routes by territory
    const territoryMap = new Map<string, LiveRoute[]>();
    
    routes.forEach(route => {
      const territory = route.territory || 'Unassigned';
      if (selectedTerritory && selectedTerritory !== 'all' && territory !== selectedTerritory) {
        return;
      }
      if (!territoryMap.has(territory)) {
        territoryMap.set(territory, []);
      }
      territoryMap.get(territory)!.push(route);
    });

    const summaries: CapacitySummary[] = [];

    territoryMap.forEach((territoryRoutes, territory) => {
      const totalStops = territoryRoutes.reduce((sum, r) => sum + r.totalStops, 0);
      const activeWorkerIds = new Set(territoryRoutes.map(r => r.assigned_to).filter(Boolean));
      const activeWorkers = activeWorkerIds.size;
      
      const avgStopsPerWorker = activeWorkers > 0 ? totalStops / activeWorkers : 0;
      const utilizationPercent = Math.min(100, (avgStopsPerWorker / OPTIMAL_STOPS_PER_WORKER) * 100);
      
      const overloadedRoutes = territoryRoutes.filter(r => r.totalStops > MAX_STOPS_PER_ROUTE).length;
      const underutilizedWorkers = territoryRoutes.filter(r => r.totalStops < 5).length;

      let capacityStatus: CapacitySummary['capacityStatus'] = 'balanced';
      if (utilizationPercent > 120) capacityStatus = 'overloaded';
      else if (utilizationPercent < 50) capacityStatus = 'underutilized';

      const recommendations: string[] = [];
      if (overloadedRoutes > 0) {
        recommendations.push(`Split ${overloadedRoutes} overloaded route(s)`);
      }
      if (underutilizedWorkers > 0) {
        recommendations.push(`Reassign ${underutilizedWorkers} underutilized worker(s)`);
      }
      if (capacityStatus === 'overloaded') {
        recommendations.push('Consider adding additional workers to this territory');
      }

      summaries.push({
        territory,
        date: selectedDate || new Date().toISOString().split('T')[0],
        totalRoutes: territoryRoutes.length,
        totalStops,
        activeWorkers,
        avgStopsPerWorker: Math.round(avgStopsPerWorker * 10) / 10,
        utilizationPercent: Math.round(utilizationPercent),
        overloadedRoutes,
        underutilizedWorkers,
        capacityStatus,
        recommendations,
      });
    });

    return summaries.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
  }, [routes, workers, selectedTerritory, selectedDate]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED PREDICTIONS SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export interface PredictionsSummary {
  totalRoutesMonitored: number;
  routesAtRisk: number;
  routesCritical: number;
  stopsOnTrack: number;
  stopsAtRisk: number;
  stopsLikelyLate: number;
  avgRiskScore: number;
  totalRecommendations: number;
  highPriorityRecommendations: number;
}

export function usePredictionsSummary(routePredictions: RoutePrediction[]): PredictionsSummary {
  return useMemo(() => {
    const summary: PredictionsSummary = {
      totalRoutesMonitored: routePredictions.length,
      routesAtRisk: routePredictions.filter(r => r.riskLevel === 'medium' || r.riskLevel === 'high').length,
      routesCritical: routePredictions.filter(r => r.riskLevel === 'critical').length,
      stopsOnTrack: 0,
      stopsAtRisk: 0,
      stopsLikelyLate: 0,
      avgRiskScore: 0,
      totalRecommendations: 0,
      highPriorityRecommendations: 0,
    };

    routePredictions.forEach(route => {
      summary.stopsOnTrack += route.stopPredictions.filter(s => s.status === 'on_track').length;
      summary.stopsAtRisk += route.stopsAtRisk;
      summary.stopsLikelyLate += route.stopsLikelyLate;
      summary.avgRiskScore += route.riskScore;
      summary.totalRecommendations += route.recommendations.length;
      summary.highPriorityRecommendations += route.recommendations.filter(r => r.priority === 'high').length;
    });

    if (routePredictions.length > 0) {
      summary.avgRiskScore = Math.round(summary.avgRiskScore / routePredictions.length);
    }

    return summary;
  }, [routePredictions]);
}
