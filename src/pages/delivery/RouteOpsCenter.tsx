import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  MessageSquare,
  UserX,
  ArrowRightLeft,
  Pause,
  Play,
  XCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDeliveryExceptions } from "@/hooks/useDeliveryExecution";
import { RouteTemplateManager } from "@/components/delivery/RouteTemplateManager";

export default function RouteOpsCenter() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  // Get active routes
  const { data: activeRoutes, isLoading, refetch } = useQuery({
    queryKey: ['active-routes-ops'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          assignee:profiles!routes_assigned_to_fkey(id, name, role)
        `)
        .eq('date', today)
        .in('status', ['planned', 'in_progress'])
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
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Get recent exceptions
  const { data: exceptions } = useDeliveryExceptions();

  const unresolvedExceptions = exceptions?.filter(e => !e.resolved_at) || [];

  return (
    <Layout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Route Ops Center</h1>
            <p className="text-muted-foreground">Real-time route execution monitoring</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Routes</p>
                  <p className="text-2xl font-bold">
                    {activeRoutes?.filter(r => r.status === 'in_progress').length || 0}
                  </p>
                </div>
                <Play className="h-8 w-8 text-green-500" />
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
                  <p className="text-sm text-muted-foreground">Stops Today</p>
                  <p className="text-2xl font-bold">
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
                  <p className="text-sm text-muted-foreground">Open Issues</p>
                  <p className="text-2xl font-bold text-red-500">
                    {unresolvedExceptions.length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

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
                          }`}
                          onClick={() => setSelectedRoute(route.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{route.territory || 'General Route'}</h4>
                                  <Badge variant={route.status === 'in_progress' ? 'default' : 'outline'}>
                                    {route.status === 'in_progress' ? 'Active' : 'Planned'}
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

                            {/* Ops Actions */}
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                Message
                              </Button>
                              <Button variant="outline" size="sm">
                                <ArrowRightLeft className="h-3 w-3 mr-1" />
                                Reassign
                              </Button>
                              <Button variant="outline" size="sm">
                                <Pause className="h-3 w-3 mr-1" />
                                Pause
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Issues Panel */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Open Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {unresolvedExceptions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                        No open issues
                      </div>
                    ) : (
                      unresolvedExceptions.map((exception) => (
                        <Card key={exception.id} className="border-red-500/20">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-2">
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
                              <span className="text-xs text-muted-foreground">
                                {new Date(exception.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1">
                              {exception.exception_type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {exception.description}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" variant="outline" className="flex-1">
                                Resolve
                              </Button>
                              <Button size="sm" variant="ghost">
                                <UserX className="h-3 w-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Route Templates Section */}
        <div className="mt-6">
          <RouteTemplateManager />
        </div>
      </div>
    </Layout>
  );
}
