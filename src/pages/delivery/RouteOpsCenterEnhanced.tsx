// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED ROUTE OPS CENTER — Floor 4 Phase 3
// Intelligence, Dispatch Control & Performance Learning
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Radio,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
  BarChart3,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDeliveryExceptions } from "@/hooks/useDeliveryExecution";
import { useAlertStats } from "@/hooks/useDeliveryAlerts";
import { useAllWorkerPerformance, useComputeRouteAnalytics, useUpdateWorkerPerformance } from "@/hooks/useRouteAnalytics";
import { DispatchControls, InterventionHistory } from "@/components/delivery/DispatchControls";
import { AlertsPanel } from "@/components/delivery/AlertsPanel";
import { WorkerPerformanceCard } from "@/components/delivery/WorkerPerformanceCard";

export default function RouteOpsCenterEnhanced() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("routes");
  const queryClient = useQueryClient();
  
  const computeAnalytics = useComputeRouteAnalytics();
  const updateWorkerPerformance = useUpdateWorkerPerformance();

  // Get active routes
  const { data: activeRoutes, isLoading, refetch } = useQuery({
    queryKey: ['active-routes-ops-enhanced'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          assignee:profiles!routes_assigned_to_fkey(id, name, role, avatar_url)
        `)
        .eq('date', today)
        .in('status', ['planned', 'in_progress', 'paused'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get stops for each route
      const routesWithStops = await Promise.all(
        (data || []).map(async (route) => {
          const { data: stops } = await supabase
            .from('route_stops')
            .select(`*, store:stores(id, name, address_city)`)
            .eq('route_id', route.id)
            .order('planned_order');

          return {
            ...route,
            stops: stops || [],
            completedStops: stops?.filter(s => s.status === 'completed').length || 0,
            totalStops: stops?.length || 0,
          };
        })
      );

      return routesWithStops;
    },
    refetchInterval: 15000,
  });

  // Get recent exceptions
  const { data: exceptions } = useDeliveryExceptions();
  const unresolvedExceptions = exceptions?.filter(e => !e.resolved_at) || [];
  
  // Get alert stats
  const { data: alertStats } = useAlertStats();
  
  // Get worker performance data
  const { data: workerPerformance } = useAllWorkerPerformance();

  const selectedRouteData = activeRoutes?.find(r => r.id === selectedRoute);
  
  // Handle route completion analytics
  const handleComputeAnalytics = async (routeId: string, workerId: string) => {
    await computeAnalytics.mutateAsync(routeId);
    await updateWorkerPerformance.mutateAsync(workerId);
  };

  return (
    <Layout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Route Ops Center</h1>
            <p className="text-muted-foreground">
              Real-time execution monitoring • Dispatch control • Performance intelligence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Radio className="h-3 w-3 text-green-500 animate-pulse" />
              Live
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">
                    {activeRoutes?.filter(r => r.status === 'in_progress').length || 0}
                  </p>
                </div>
                <Zap className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Planned</p>
                  <p className="text-2xl font-bold">
                    {activeRoutes?.filter(r => r.status === 'planned').length || 0}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Stops</p>
                  <p className="text-2xl font-bold">
                    {activeRoutes?.reduce((acc, r) => acc + r.completedStops, 0) || 0}/
                    {activeRoutes?.reduce((acc, r) => acc + r.totalStops, 0) || 0}
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alerts</p>
                  <p className="text-2xl font-bold text-red-500">
                    {alertStats?.total || 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Workers</p>
                  <p className="text-2xl font-bold">
                    {workerPerformance?.length || 0}
                  </p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="routes">
              <MapPin className="h-4 w-4 mr-2" />
              Routes
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts
              {alertStats && alertStats.total > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {alertStats.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="performance">
              <BarChart3 className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
          </TabsList>

          {/* Routes Tab */}
          <TabsContent value="routes">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Routes Panel */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Active Routes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-4">
                        {isLoading ? (
                          <div className="text-center py-8 text-muted-foreground">
                            Loading routes...
                          </div>
                        ) : activeRoutes?.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No active routes today
                          </div>
                        ) : (
                          activeRoutes?.map((route) => (
                            <Card 
                              key={route.id} 
                              className={`cursor-pointer transition-all ${
                                selectedRoute === route.id ? 'ring-2 ring-primary' : ''
                              } ${route.status === 'paused' ? 'opacity-60' : ''}`}
                              onClick={() => setSelectedRoute(route.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold">{route.territory || 'General Route'}</h4>
                                      <Badge 
                                        variant={
                                          route.status === 'in_progress' ? 'default' : 
                                          route.status === 'paused' ? 'secondary' : 'outline'
                                        }
                                      >
                                        {route.status === 'in_progress' ? 'Active' : 
                                         route.status === 'paused' ? 'Paused' : 'Planned'}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {route.assignee?.name || 'Unassigned'} • {route.type || 'delivery'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold">
                                      {route.completedStops}/{route.totalStops}
                                    </p>
                                    <p className="text-xs text-muted-foreground">stops</p>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-muted rounded-full h-2 mb-3">
                                  <div 
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ 
                                      width: `${route.totalStops > 0 ? (route.completedStops / route.totalStops) * 100 : 0}%` 
                                    }}
                                  />
                                </div>

                                {/* Dispatch Controls */}
                                <DispatchControls
                                  routeId={route.id}
                                  currentStatus={route.status}
                                  currentAssignee={route.assignee}
                                  onActionComplete={() => refetch()}
                                />
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Route Details / Issues Panel */}
              <div className="space-y-4">
                {/* Selected Route Details */}
                {selectedRouteData && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Route Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Territory</p>
                          <p className="font-medium">{selectedRouteData.territory || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Type</p>
                          <p className="font-medium capitalize">{selectedRouteData.type || 'delivery'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Est. Distance</p>
                          <p className="font-medium">
                            {selectedRouteData.estimated_distance_km || '-'} km
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Est. Duration</p>
                          <p className="font-medium">
                            {selectedRouteData.estimated_duration_minutes || '-'} min
                          </p>
                        </div>
                      </div>
                      
                      {/* Intervention History */}
                      <div>
                        <h5 className="font-medium mb-2 flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Interventions
                        </h5>
                        <InterventionHistory routeId={selectedRouteData.id} />
                      </div>
                      
                      {/* Compute Analytics Button */}
                      {selectedRouteData.status === 'completed' && (
                        <Button 
                          className="w-full"
                          onClick={() => handleComputeAnalytics(
                            selectedRouteData.id, 
                            selectedRouteData.assigned_to
                          )}
                          disabled={computeAnalytics.isPending}
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Compute Analytics
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Issues Panel */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Open Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {unresolvedExceptions.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                            No open issues
                          </div>
                        ) : (
                          unresolvedExceptions.slice(0, 5).map((exception) => (
                            <div 
                              key={exception.id} 
                              className="p-2 bg-red-500/5 border border-red-500/10 rounded-lg"
                            >
                              <Badge 
                                variant="outline" 
                                className={
                                  exception.severity === 'critical' ? 'border-red-500 text-red-500' :
                                  exception.severity === 'high' ? 'border-orange-500 text-orange-500' :
                                  'border-yellow-500 text-yellow-500'
                                }
                              >
                                {exception.severity}
                              </Badge>
                              <p className="text-sm mt-1">
                                {exception.exception_type.replace(/_/g, ' ')}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts">
            <AlertsPanel />
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workerPerformance?.map((perf) => (
                <WorkerPerformanceCard 
                  key={perf.id} 
                  performance={perf as any}
                />
              ))}
              
              {(!workerPerformance || workerPerformance.length === 0) && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No performance data yet</p>
                  <p className="text-sm">Complete routes to build worker profiles</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
