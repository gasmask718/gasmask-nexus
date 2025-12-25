import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useSimulationMode, SimulationBadge, SimulatedSection } from '@/contexts/SimulationModeContext';
import { SimulationModeToggle, SimulationBanner } from '@/components/delivery/SimulationModeToggle';
import { useSimulationData } from '@/hooks/useSimulationData';
import { 
  Truck, MapPin, Package, Clock, Play, RefreshCw,
  AlertTriangle, DollarSign, CheckCircle2, Navigation,
  Calendar, MessageSquare, History, FileText, User,
  ChevronRight, Zap, Phone, GraduationCap, Eye
} from 'lucide-react';

type DriverStatus = 'available' | 'on_route' | 'offline';

const DriverHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();
  const simData = useSimulationData();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('available');

  // Fetch driver's active routes for today (assigned to current driver)
  const { data: activeRoutes = [], isLoading: loadingActive, refetch: refetchActive } = useQuery({
    queryKey: ['driver-active-routes', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          delivery_stops (*)
        `)
        .eq('assigned_driver_id', user.id)
        .eq('scheduled_date', today)
        .in('status', ['scheduled', 'in_progress'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch upcoming routes (next 3 days)
  const { data: upcomingRoutes = [] } = useQuery({
    queryKey: ['driver-upcoming-routes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id, scheduled_date, priority, status, delivery_type,
          delivery_stops(count)
        `)
        .eq('assigned_driver_id', user.id)
        .gt('scheduled_date', today)
        .in('status', ['scheduled', 'draft'])
        .order('scheduled_date', { ascending: true })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch last completed route
  const { data: lastCompleted } = useQuery({
    queryKey: ['driver-last-completed', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id, scheduled_date, delivery_type, updated_at,
          delivery_stops(count)
        `)
        .eq('assigned_driver_id', user.id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch recent activity (from routes table if available)
  const { data: recentActivity = [] } = useQuery({
    queryKey: ['driver-recent-activity', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('routes')
        .select('id, date, status, type, territory')
        .eq('assigned_to', user.id)
        .order('date', { ascending: false })
        .limit(5);
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
  });

  // FORCE SIMULATION DATA: Resolve routes - real data takes priority, then simulation
  const hasRealData = activeRoutes.length > 0;
  const showSimulated = simulationMode && !hasRealData;
  
  // FORCED: Get simulation route when no real data - always use simData from context
  const simRoute = showSimulated && simData.routes && simData.routes.length > 0 ? {
    id: simData.routes[0].id,
    status: simData.routes[0].status,
    priority: simData.routes[0].priority,
    delivery_type: simData.routes[0].delivery_type,
    scheduled_date: simData.routes[0].scheduled_date,
    dispatcher_notes: simData.routes[0].dispatcher_notes,
    delivery_stops: simData.routes[0].stops.map(s => ({
      id: s.id,
      status: s.status,
      store_name: s.store_name,
    })),
    driver_name: simData.routes[0].driver_name,
    estimated_earnings: simData.routes[0].estimated_earnings,
    is_simulated: true,
  } : null;

  // FORCED: Calculate stats from real or sim data
  const totalDeliveries = hasRealData ? activeRoutes.length : (showSimulated ? 1 : 0);
  const totalStops = hasRealData 
    ? activeRoutes.reduce((sum, d: any) => sum + (d.delivery_stops?.length || 0), 0)
    : (showSimulated && simData.routes?.[0] ? simData.routes[0].total_stops : 0);
  const completedStops = hasRealData 
    ? activeRoutes.reduce((sum, d: any) => sum + (d.delivery_stops?.filter((s: any) => s.status === 'completed').length || 0), 0)
    : (showSimulated && simData.routes?.[0] ? simData.routes[0].completed_stops : 0);
  const pendingStops = totalStops - completedStops;
  
  // FORCED: Alerts and earnings for simulation
  const alerts = hasRealData 
    ? activeRoutes.flatMap((d: any) => 
        d.delivery_stops?.filter((s: any) => 
          s.amount_due > 0 || (s.window_end && new Date(`${today}T${s.window_end}`) < new Date(Date.now() + 60 * 60 * 1000))
        ) || []
      )
    : (showSimulated && simData.routes?.[0] ? simData.routes[0].stops.filter(s => s.amount_due > 0).slice(0, 3) : []);

  const estimatedEarnings = hasRealData ? 0 : (showSimulated && simData.routes?.[0] ? simData.routes[0].estimated_earnings : 320);

  // Get active route (real or simulated)
  const activeRoute = hasRealData 
    ? (activeRoutes.find((r: any) => r.status === 'in_progress') || activeRoutes.find((r: any) => r.status === 'scheduled'))
    : simRoute;

  const handleRefresh = () => {
    refetchActive();
    queryClient.invalidateQueries({ queryKey: ['driver-upcoming-routes'] });
    queryClient.invalidateQueries({ queryKey: ['driver-last-completed'] });
    toast.success('Data refreshed');
  };

  const toggleStatus = () => {
    const statusOrder: DriverStatus[] = ['available', 'on_route', 'offline'];
    const currentIndex = statusOrder.indexOf(driverStatus);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    setDriverStatus(nextStatus);
    toast.info(`Status changed to ${nextStatus.replace('_', ' ')}`);
  };

  const getStatusColor = (status: DriverStatus) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'on_route': return 'bg-blue-500';
      case 'offline': return 'bg-gray-400';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'outline',
      normal: 'secondary',
      high: 'default',
      urgent: 'destructive'
    };
    return <Badge variant={variants[priority] || 'secondary'}>{priority}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-green-100 text-green-700',
      completed: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
        <SimulationBanner />
        
        {/* SECTION A — Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Driver Command Center
              {showSimulated && <SimulationBadge className="ml-2" />}
            </h1>
            <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="flex items-center gap-3">
            <SimulationModeToggle />
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleStatus}
              className="flex items-center gap-2"
            >
              <span className={`h-3 w-3 rounded-full ${getStatusColor(driverStatus)}`} />
              {driverStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          </div>
        </div>

        {/* Stats Row - FORCED values */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalDeliveries}</div>
                  <p className="text-sm text-muted-foreground">Routes Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{pendingStops}</div>
                  <p className="text-sm text-muted-foreground">Stops Left</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{completedStops}</div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">${estimatedEarnings || 320}</div>
                  <p className="text-sm text-muted-foreground">Est. Earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECTION B — Primary Action - Active Route */}
        {activeRoute ? (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Active Route
                {(activeRoute as any).is_simulated && <SimulationBadge className="ml-2" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-muted-foreground">
                      #{activeRoute.id.slice(0, 12)}
                    </span>
                    {getStatusBadge(activeRoute.status)}
                    {getPriorityBadge(activeRoute.priority)}
                    <Badge variant="outline">{activeRoute.delivery_type}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {(activeRoute as any).delivery_stops?.filter((s: any) => s.status === 'completed').length || completedStops}/
                      {(activeRoute as any).delivery_stops?.length || totalStops} stops
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Start: 9:30 AM
                    </span>
                  </div>
                  {activeRoute.dispatcher_notes && (
                    <p className="text-sm bg-muted p-2 rounded">{activeRoute.dispatcher_notes}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {activeRoute.status === 'scheduled' && (
                    <Button 
                      size="lg" 
                      onClick={() => navigate(`/delivery/my-route/${activeRoute.id}`)}
                    >
                      <Play className="h-4 w-4 mr-2" /> Start Route
                    </Button>
                  )}
                  {activeRoute.status === 'in_progress' && (
                    <Button 
                      size="lg" 
                      onClick={() => navigate(`/delivery/my-route/${activeRoute.id}`)}
                    >
                      <Navigation className="h-4 w-4 mr-2" /> View Route
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" /> Contact Dispatcher
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${totalStops > 0 ? (completedStops / totalStops) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                <Truck className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No Active Route</h3>
                <p className="text-muted-foreground text-sm">
                  {simulationMode ? 'Loading simulation data...' : 'You\'re all caught up! No deliveries assigned for today yet.'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <Button variant="outline" onClick={() => setDriverStatus('available')}>
                  <User className="h-4 w-4 mr-2" /> Set Available
                </Button>
                <Button variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" /> Message Dispatcher
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION B — Primary Action */}
        {activeRoute ? (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Active Route
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-muted-foreground">
                      #{activeRoute.id.slice(0, 8)}
                    </span>
                    {getStatusBadge(activeRoute.status)}
                    {getPriorityBadge(activeRoute.priority)}
                    <Badge variant="outline">{activeRoute.delivery_type}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {activeRoute.delivery_stops?.filter((s: any) => s.status === 'completed').length || 0}/
                      {activeRoute.delivery_stops?.length || 0} stops
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {activeRoute.scheduled_date}
                    </span>
                  </div>
                  {activeRoute.dispatcher_notes && (
                    <p className="text-sm bg-muted p-2 rounded">{activeRoute.dispatcher_notes}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {activeRoute.status === 'scheduled' && (
                    <Button 
                      size="lg" 
                      onClick={() => navigate(`/delivery/my-route/${activeRoute.id}`)}
                    >
                      <Play className="h-4 w-4 mr-2" /> Start Route
                    </Button>
                  )}
                  {activeRoute.status === 'in_progress' && (
                    <Button 
                      size="lg" 
                      onClick={() => navigate(`/delivery/my-route/${activeRoute.id}`)}
                    >
                      <Navigation className="h-4 w-4 mr-2" /> Continue Route
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" /> Contact Dispatcher
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {activeRoute.delivery_stops?.length > 0 
                      ? Math.round((activeRoute.delivery_stops.filter((s: any) => s.status === 'completed').length / activeRoute.delivery_stops.length) * 100) 
                      : 0}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ 
                      width: `${activeRoute.delivery_stops?.length > 0 
                        ? (activeRoute.delivery_stops.filter((s: any) => s.status === 'completed').length / activeRoute.delivery_stops.length) * 100 
                        : 0}%` 
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                <Truck className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No Active Route</h3>
                <p className="text-muted-foreground text-sm">
                  You're all caught up! No deliveries assigned for today yet.
                </p>
              </div>

              {/* Show last completed if exists */}
              {lastCompleted && (
                <div className="bg-muted/50 rounded-lg p-4 text-left">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Last Completed Route
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(lastCompleted.scheduled_date), 'MMM d, yyyy')} · {lastCompleted.delivery_type}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate(`/delivery/my-route/${lastCompleted.id}`)}
                    >
                      View <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <Button variant="outline" onClick={() => setDriverStatus('available')}>
                  <User className="h-4 w-4 mr-2" /> Set Available
                </Button>
                <Button variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" /> Message Dispatcher
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts Panel */}
        {alerts.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-5 w-5" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((stop: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-background rounded">
                    <div className="flex items-center gap-2">
                      {stop.amount_due > 0 && (
                        <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400">
                          <DollarSign className="h-3 w-3 mr-1" />${stop.amount_due}
                        </Badge>
                      )}
                      {stop.window_end && (
                        <Badge variant="outline" className="text-orange-700 dark:text-orange-400">
                          <Clock className="h-3 w-3 mr-1" />Due by {stop.window_end}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION C — Upcoming Routes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingRoutes.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming routes scheduled.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingRoutes.map((route: any) => (
                  <div 
                    key={route.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {format(new Date(route.scheduled_date), 'd')}
                      </div>
                      <div>
                        <div className="font-medium">{format(new Date(route.scheduled_date), 'EEEE, MMM d')}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{route.delivery_type}</Badge>
                          {getPriorityBadge(route.priority)}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECTION D — Recent Activity */}
        {recentActivity.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivity.map((activity: any) => (
                  <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {activity.type || 'Route'} · {activity.territory || 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.date), 'MMM d, yyyy')} · {activity.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION E — Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/delivery/my-route')}
              >
                <Navigation className="h-6 w-6" />
                <span className="text-sm">My Route</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/delivery/payouts')}
              >
                <DollarSign className="h-6 w-6" />
                <span className="text-sm">My Payouts</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <AlertTriangle className="h-6 w-6" />
                <span className="text-sm">Report Issue</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <Phone className="h-6 w-6" />
                <span className="text-sm">Dispatcher</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DriverHome;
