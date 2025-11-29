// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES PAGE — Route Plans Management
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouteBuilder, RoutePlan, RouteStatus, StopStatus } from '@/hooks/useRouteBuilder';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  Play, 
  CheckCircle2, 
  X, 
  MapPin, 
  Calendar,
  Clock,
  User,
  Loader2,
  RefreshCw,
  ChevronRight,
  Navigation,
  SkipForward
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

const statusColors: Record<RouteStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-muted',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const stopStatusColors: Record<StopStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  visited: 'bg-emerald-500/20 text-emerald-400',
  skipped: 'bg-muted text-muted-foreground',
};

export default function RoutesPage() {
  const { routes, loading, getRoutes, getRouteWithStops, updateRouteStatus, markStopCompleted } = useRouteBuilder();
  const { canUpdate } = usePermissions();
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<RoutePlan | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const isReadOnly = !canUpdate('deliveries');

  useEffect(() => {
    getRoutes();
  }, [getRoutes]);

  const filteredRoutes = routes.filter(route => {
    if (statusFilter !== 'all' && route.status !== statusFilter) return false;
    return true;
  });

  const handleViewRoute = async (routeId: string) => {
    setLoadingDetail(true);
    const routeDetail = await getRouteWithStops(routeId);
    setSelectedRoute(routeDetail);
    setLoadingDetail(false);
  };

  const handleStartRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'in_progress');
    if (selectedRoute?.id === routeId) {
      setSelectedRoute({ ...selectedRoute, status: 'in_progress' });
    }
  };

  const handleCompleteRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'completed');
    if (selectedRoute?.id === routeId) {
      setSelectedRoute({ ...selectedRoute, status: 'completed' });
    }
  };

  const handleCancelRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'cancelled');
    if (selectedRoute?.id === routeId) {
      setSelectedRoute({ ...selectedRoute, status: 'cancelled' });
    }
  };

  const handleStopAction = async (stopId: string, status: StopStatus) => {
    await markStopCompleted(stopId, status);
    if (selectedRoute) {
      const updatedStops = selectedRoute.stops?.map(s =>
        s.id === stopId ? { ...s, status } : s
      );
      setSelectedRoute({ ...selectedRoute, stops: updatedStops });
    }
  };

  return (
    <GrabbaLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Route Plans</h1>
            <p className="text-muted-foreground">Manage delivery routes and stops</p>
          </div>
          <Button onClick={() => getRoutes()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <span className="text-sm text-muted-foreground">Filter by status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Routes Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredRoutes.length === 0 ? (
          <Card className="bg-card/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No routes found</p>
              <p className="text-sm">Create routes from the Results Panel or Command Console</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoutes.map(route => (
              <Card 
                key={route.id} 
                className="bg-card/50 hover:bg-card/80 transition-colors cursor-pointer"
                onClick={() => handleViewRoute(route.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-foreground line-clamp-1">{route.name}</h3>
                    <Badge className={statusColors[route.status]}>
                      {route.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(route.scheduled_date), 'MMM d, yyyy')}
                    </div>
                    
                    {route.start_time && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {route.start_time}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {route.total_stops} stops
                    </div>
                    
                    {route.driver && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {route.driver.name}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    {route.brand && (
                      <Badge variant="outline" className="text-xs">
                        {route.brand}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Route Detail Sheet */}
        <Sheet open={!!selectedRoute} onOpenChange={() => setSelectedRoute(null)}>
          <SheetContent className="w-full sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>{selectedRoute?.name}</SheetTitle>
            </SheetHeader>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedRoute && (
              <div className="mt-6 space-y-6">
                {/* Route Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <Badge className={statusColors[selectedRoute.status]}>
                      {selectedRoute.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Date</label>
                    <p className="text-sm">{format(new Date(selectedRoute.scheduled_date), 'PPP')}</p>
                  </div>
                  {selectedRoute.driver && (
                    <div>
                      <label className="text-xs text-muted-foreground">Driver</label>
                      <p className="text-sm">{selectedRoute.driver.name}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground">Stops</label>
                    <p className="text-sm">{selectedRoute.total_stops}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                {!isReadOnly && (
                  <div className="flex gap-2">
                    {selectedRoute.status === 'scheduled' && (
                      <Button onClick={() => handleStartRoute(selectedRoute.id)} className="flex-1">
                        <Play className="h-4 w-4 mr-2" />
                        Start Route
                      </Button>
                    )}
                    {selectedRoute.status === 'in_progress' && (
                      <Button onClick={() => handleCompleteRoute(selectedRoute.id)} className="flex-1">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Complete Route
                      </Button>
                    )}
                    {(selectedRoute.status === 'scheduled' || selectedRoute.status === 'draft') && (
                      <Button 
                        variant="destructive" 
                        onClick={() => handleCancelRoute(selectedRoute.id)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </div>
                )}

                {/* Map Placeholder */}
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="py-8 text-center">
                    <Navigation className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Map view coming soon</p>
                  </CardContent>
                </Card>

                {/* Stops List */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Stops ({selectedRoute.stops?.length || 0})</h4>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {selectedRoute.stops?.map((stop, idx) => (
                        <Card key={stop.id} className="bg-card/50">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                                  {idx + 1}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">
                                    {stop.store?.name || 'Unknown Store'}
                                  </p>
                                  {stop.store?.address && (
                                    <p className="text-xs text-muted-foreground">{stop.store.address}</p>
                                  )}
                                </div>
                              </div>
                              <Badge className={stopStatusColors[stop.status]}>
                                {stop.status}
                              </Badge>
                            </div>

                            {!isReadOnly && stop.status === 'pending' && selectedRoute.status === 'in_progress' && (
                              <div className="mt-3 flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStopAction(stop.id, 'visited');
                                  }}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Mark Visited
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStopAction(stop.id, 'skipped');
                                  }}
                                >
                                  <SkipForward className="h-3 w-3 mr-1" />
                                  Skip
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </GrabbaLayout>
  );
}
