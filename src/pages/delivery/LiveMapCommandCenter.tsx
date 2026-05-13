// ═══════════════════════════════════════════════════════════════════════════════
// LIVE MAP COMMAND CENTER — Floor 4 Situational Awareness
// Real-time tracking, route visualization, alerts, dispatch actions & predictions
// Phase 3 (Execution) + Phase 3.6 (Polish) + Phase 4 (Predictive Intelligence)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  useLiveRoutes,
  useLiveWorkers,
  useLiveAlerts,
  useLiveDeliveryTasks,
  useMapState,
  useLiveMapSubscription,
} from "@/hooks/useLiveMapData";
import {
  useRoutePredictions,
  useCapacityIntelligence,
  usePredictionsSummary,
} from "@/hooks/useRouteIntelligence";
import {
  MapFiltersBar,
  MapFilters,
  RouteListPanel,
  WorkerDrawer,
  RouteDrawer,
  AlertDrawer,
  LiveMapLegend,
  MapCanvas,
} from "@/components/livemap";
import { CommandControlsBar } from "@/components/livemap/CommandControlsBar";
import { PredictionOverlay } from "@/components/livemap/PredictionOverlay";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Navigation } from "lucide-react";
import { toast } from "sonner";
import type { MapStore } from "@/components/livemap/MapCanvas";

export default function LiveMapCommandCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Date and territory state (Phase 3.6)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTerritory, setSelectedTerritory] = useState<string>('all');
  const [predictionMode, setPredictionMode] = useState<boolean>(false);
  
  // Data hooks
  const { data: routes = [], isLoading: routesLoading, refetch: refetchRoutes } = useLiveRoutes();
  const { data: workers = [], isLoading: workersLoading, refetch: refetchWorkers } = useLiveWorkers();
  const { data: alerts = [], refetch: refetchAlerts } = useLiveAlerts();
  const { data: deliveryTasks = [] } = useLiveDeliveryTasks();
  
  // Enable real-time subscriptions
  useLiveMapSubscription();

  // Map state
  const mapState = useMapState();
  
  // Filters
  const [filters, setFilters] = useState<MapFilters>({
    search: '',
    roles: [],
    statuses: [],
    showAlerts: true,
    showCriticalOnly: false,
    showSLABreached: false,
    showStores: true,
  });
  
  // Stores query
  const { data: mapStores = [] } = useQuery({
    queryKey: ['live-map-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, lat, lng, address_street, address_city, address_state, phone, status, health_score, type')
        .eq('approval_status', 'approved') // Phase 7: exclude pending captures
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (error) throw error;
      return (data || []) as MapStore[];
    },
    refetchInterval: 60000,
  });

  // Geocoding state
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // Refresh tracking
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update last refresh time
  useEffect(() => {
    setLastRefresh(new Date());
  }, [routes, workers, alerts]);

  // Filter routes based on filters + date + territory
  const filteredRoutes = useMemo(() => {
    return routes.filter(route => {
      // Date filter
      const routeDate = format(new Date(route.date), 'yyyy-MM-dd');
      const filterDate = format(selectedDate, 'yyyy-MM-dd');
      if (routeDate !== filterDate) return false;
      
      // Territory filter
      if (selectedTerritory !== 'all' && route.territory !== selectedTerritory) {
        return false;
      }
      
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesSearch = 
          route.assignee?.name?.toLowerCase().includes(search) ||
          route.territory?.toLowerCase().includes(search) ||
          route.stops.some(s => s.store?.name?.toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }

      // Role filter
      if (filters.roles.length > 0) {
        const role = route.assignee?.role || route.type;
        if (!filters.roles.includes(role)) return false;
      }

      // Status filter
      if (filters.statuses.length > 0) {
        const status = route.status === 'in_progress' ? 'active' : route.status;
        if (!filters.statuses.includes(status)) return false;
      }

      return true;
    });
  }, [routes, filters, selectedDate, selectedTerritory]);

  // Filter workers based on filters
  const filteredWorkers = useMemo(() => {
    return workers.filter(worker => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!worker.name.toLowerCase().includes(search)) return false;
      }

      if (filters.roles.length > 0) {
        if (!filters.roles.includes(worker.role)) return false;
      }

      return true;
    });
  }, [workers, filters]);

  // Filter alerts based on filters
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (filters.showCriticalOnly && alert.severity !== 'critical') return false;
      if (filters.showSLABreached && !alert.sla_breached) return false;
      return true;
    });
  }, [alerts, filters]);

  // Enrich routes with alert counts
  const enrichedRoutes = useMemo(() => {
    return filteredRoutes.map(route => {
      const routeAlerts = alerts.filter(a => a.route_id === route.id);
      return {
        ...route,
        hasAlerts: routeAlerts.length > 0,
        alertCount: routeAlerts.length,
      };
    });
  }, [filteredRoutes, alerts]);

  // Phase 4: Predictive Intelligence
  const routePredictions = useRoutePredictions(enrichedRoutes, alerts.map(a => ({ route_id: a.route_id, severity: a.severity })));
  const capacitySummary = useCapacityIntelligence(enrichedRoutes, filteredWorkers, selectedTerritory);
  const predictionsSummary = usePredictionsSummary(routePredictions);

  // Stats for filters bar
  const stats = useMemo(() => ({
    totalRoutes: routes.length,
    totalWorkers: workers.length,
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
    totalStores: mapStores.length,
  }), [routes, workers, alerts, mapStores]);

  // Geocode handler
  const handleGeocodeStores = useCallback(async () => {
    setIsGeocoding(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-geocode-stores', {
        body: { revalidate: false },
      });
      if (error) throw error;
      const g = data?.geocoded || 0;
      const f = data?.failed || 0;
      const s = data?.skipped || 0;
      toast.success(`Validated ${g} stores, ${f} failed, ${s} skipped (${data?.total || 0} processed)`);
      queryClient.invalidateQueries({ queryKey: ['live-map-stores'] });
    } catch (err) {
      toast.error('Failed to geocode stores');
      console.error(err);
    } finally {
      setIsGeocoding(false);
    }
  }, [queryClient]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchRoutes(),
      refetchWorkers(),
      refetchAlerts(),
    ]);
    setIsRefreshing(false);
    setLastRefresh(new Date());
  }, [refetchRoutes, refetchWorkers, refetchAlerts]);

  // Get selected entities for drawers
  const selectedRoute = enrichedRoutes.find(r => r.id === mapState.selectedRoute) || null;
  const selectedWorker = workers.find(w => w.worker_id === mapState.selectedWorker) || null;
  const selectedAlert = alerts.find(a => a.id === mapState.selectedAlert) || null;
  
  // Get route for selected worker
  const workerRoute = selectedWorker 
    ? enrichedRoutes.find(r => r.assigned_to === selectedWorker.worker_id) || null
    : null;

  // Focus on route
  const handleFocusRoute = useCallback((routeId: string) => {
    mapState.selectRoute(routeId);
  }, [mapState]);

  // Focus on stop
  const handleFocusStop = useCallback((stop: any) => {
    mapState.selectStop(stop.id);
  }, [mapState]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/delivery')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Live Map Command Center</h1>
          </div>
        </div>
        
        {/* Command Controls (Phase 3.6 + Phase 4) */}
        <CommandControlsBar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          selectedTerritory={selectedTerritory}
          onTerritoryChange={setSelectedTerritory}
          predictionMode={predictionMode}
          onPredictionModeChange={setPredictionMode}
          stats={predictionMode ? {
            avgRiskScore: predictionsSummary.avgRiskScore,
            routesAtRisk: predictionsSummary.routesAtRisk,
            stopsLikelyLate: predictionsSummary.stopsLikelyLate,
          } : undefined}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Route List */}
        <RouteListPanel
          routes={enrichedRoutes}
          workers={filteredWorkers}
          alerts={filteredAlerts}
          selectedRouteId={mapState.selectedRoute}
          onSelectRoute={mapState.selectRoute}
          onSelectWorker={mapState.selectWorker}
          onSelectAlert={mapState.selectAlert}
          onFocusRoute={handleFocusRoute}
        />

        {/* Map Area */}
        <div className="flex-1 relative">
          {/* Filters Bar */}
          <MapFiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            lastRefresh={lastRefresh}
            stats={stats}
            onGeocodeStores={handleGeocodeStores}
            isGeocoding={isGeocoding}
          />

          {/* Map Canvas */}
          <MapCanvas
            routes={enrichedRoutes}
            workers={filteredWorkers}
            alerts={filteredAlerts}
            deliveryTasks={deliveryTasks}
            stores={mapStores}
            showStores={filters.showStores}
            selectedRouteId={mapState.selectedRoute}
            selectedWorkerId={mapState.selectedWorker}
            followWorkerId={mapState.followWorker}
            onSelectRoute={mapState.selectRoute}
            onSelectWorker={mapState.selectWorker}
            onSelectStop={mapState.selectStop}
            onSelectAlert={mapState.selectAlert}
          />

          {/* Prediction Overlay (Phase 4) */}
          <PredictionOverlay
            visible={predictionMode}
            predictions={routePredictions}
            capacitySummary={capacitySummary}
            summary={predictionsSummary}
            onSelectRoute={mapState.selectRoute}
          />

          {/* Legend */}
          <LiveMapLegend />
        </div>
      </div>

      {/* Drawers */}
      <WorkerDrawer
        worker={selectedWorker}
        route={workerRoute}
        open={!!mapState.selectedWorker}
        onClose={() => mapState.selectWorker(null)}
        onFollowWorker={mapState.toggleFollowWorker}
        isFollowing={mapState.followWorker === selectedWorker?.worker_id}
      />

      <RouteDrawer
        route={selectedRoute}
        open={!!mapState.selectedRoute}
        onClose={() => mapState.selectRoute(null)}
        onFocusStop={handleFocusStop}
      />

      <AlertDrawer
        alert={selectedAlert}
        open={!!mapState.selectedAlert}
        onClose={() => mapState.selectAlert(null)}
      />
    </div>
  );
}
