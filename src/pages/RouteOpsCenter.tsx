import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RouteOpsCenter = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [lastRun, setLastRun] = useState<any>(null);

  // Fetch coverage stats
  const { data: stores, isLoading: loadingStores } = useQuery({
    queryKey: ['stores-coverage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, status, last_visit_date, visit_risk_level, last_visit_driver_id')
        .eq('status', 'active');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch driver performance
  const { data: driverPerformance } = useQuery({
    queryKey: ['driver-performance-latest'],
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('route_performance_snapshots')
        .select(`
          *,
          driver:profiles(name)
        `)
        .eq('date', yesterday)
        .order('efficiency_score', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch tomorrow's routes
  const { data: upcomingRoutes } = useQuery({
    queryKey: ['routes-tomorrow'],
    queryFn: async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('routes_generated')
        .select(`
          *,
          driver:profiles(name)
        `)
        .eq('date', tomorrow);
      
      if (error) throw error;
      return data;
    },
  });

  // Run optimizer mutation
  const runOptimizer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('route-optimizer-engine', {
        body: { targetDate: null }, // null = tomorrow
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastRun(data);
      toast({
        title: "Route Optimizer Complete",
        description: `${data.routesCreated} routes created for ${data.datePlanned}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Optimization Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activeStores = stores?.length || 0;
  const criticalStores = stores?.filter(s => s.visit_risk_level === 'critical') || [];
  const atRiskStores = stores?.filter(s => s.visit_risk_level === 'at_risk') || [];
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const recentlyVisited = stores?.filter(s => 
    s.last_visit_date && new Date(s.last_visit_date) >= sevenDaysAgo
  ).length || 0;

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'at_risk':
        return <Badge className="bg-orange-500">At Risk</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-600">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-600">Good</Badge>;
    if (score >= 40) return <Badge className="bg-orange-600">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Route Ops Command Center</h1>
          <p className="text-muted-foreground">Coverage, driver performance, and daily optimization</p>
        </div>
        <Button 
          onClick={() => runOptimizer.mutate()}
          disabled={runOptimizer.isPending}
          size="lg"
        >
          {runOptimizer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Run Route Optimizer
        </Button>
      </div>

      {/* Last Run Summary */}
      {lastRun && (
        <Card>
          <CardHeader>
            <CardTitle>Last Optimization Run</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Date Planned</p>
                <p className="font-semibold">{lastRun.datePlanned}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Routes Created</p>
                <p className="font-semibold">{lastRun.routesCreated}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Critical Covered</p>
                <p className="font-semibold text-red-600">{lastRun.criticalStoresCovered}</p>
              </div>
              <div>
                <p className="text-muted-foreground">At-Risk Covered</p>
                <p className="font-semibold text-orange-600">{lastRun.atRiskStoresCovered}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active Stores</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStores}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visited (Last 7 Days)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentlyVisited}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((recentlyVisited / Math.max(activeStores, 1)) * 100)}% coverage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At-Risk Stores</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{atRiskStores.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Stores</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalStores.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Critical & At-Risk Stores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Critical Stores (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStores ? (
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            ) : (
              <div className="space-y-3">
                {criticalStores.slice(0, 10).map((store: any) => {
                  const daysSince = store.last_visit_date 
                    ? Math.floor((Date.now() - new Date(store.last_visit_date).getTime()) / (1000 * 60 * 60 * 24))
                    : 999;
                  
                  return (
                    <div key={store.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{store.name}</p>
                        <p className="text-xs text-red-600">{daysSince} days since visit</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/stores/${store.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  );
                })}
                {criticalStores.length === 0 && (
                  <p className="text-center text-muted-foreground">No critical stores</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>At-Risk Stores (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStores ? (
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            ) : (
              <div className="space-y-3">
                {atRiskStores.slice(0, 10).map((store: any) => {
                  const daysSince = store.last_visit_date 
                    ? Math.floor((Date.now() - new Date(store.last_visit_date).getTime()) / (1000 * 60 * 60 * 24))
                    : 999;
                  
                  return (
                    <div key={store.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{store.name}</p>
                        <p className="text-xs text-orange-600">{daysSince} days since visit</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/stores/${store.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  );
                })}
                {atRiskStores.length === 0 && (
                  <p className="text-center text-muted-foreground">No at-risk stores</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Driver Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Driver Performance (Yesterday)</CardTitle>
        </CardHeader>
        <CardContent>
          {!driverPerformance || driverPerformance.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No performance data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Driver</th>
                    <th className="text-center py-2">Total Stops</th>
                    <th className="text-center py-2">Completed</th>
                    <th className="text-center py-2">Rate</th>
                    <th className="text-center py-2">Efficiency</th>
                    <th className="text-center py-2">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {driverPerformance.map((perf: any) => (
                    <tr key={perf.id} className="border-b">
                      <td className="py-3">{perf.driver?.name || 'Unknown'}</td>
                      <td className="text-center">{perf.total_stops}</td>
                      <td className="text-center">{perf.completed_stops}</td>
                      <td className="text-center">{Math.round(perf.completion_rate)}%</td>
                      <td className="text-center">{getScoreBadge(perf.efficiency_score)}</td>
                      <td className="text-center">{getScoreBadge(perf.coverage_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Routes */}
      <Card>
        <CardHeader>
          <CardTitle>Tomorrow's Routes</CardTitle>
        </CardHeader>
        <CardContent>
          {!upcomingRoutes || upcomingRoutes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No routes scheduled for tomorrow</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upcomingRoutes.map((route: any) => (
                <div key={route.id} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4" />
                    <p className="font-semibold">{route.driver?.name || 'Unassigned'}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {route.store_ids?.length || 0} stops
                  </p>
                  {route.optimization_score && (
                    <p className="text-xs mt-2">
                      Optimization: {getScoreBadge(route.optimization_score)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RouteOpsCenter;
