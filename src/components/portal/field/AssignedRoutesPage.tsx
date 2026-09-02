import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useMyAssignedRoutes, type CanonicalRouteStop } from '@/hooks/delivery/useMyAssignedRoutes';
import { useCall } from '@/components/communication/CallProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, Clock, Loader2, MapPin, Navigation, Phone, Route as RouteIcon, Store } from 'lucide-react';
import { toast } from 'sonner';

interface AssignedRoutesPageProps {
  portalType: 'driver' | 'biker';
}

const isFinished = (status: string) => ['completed', 'complete', 'failed', 'skipped'].includes(status);

export function AssignedRoutesPage({ portalType }: AssignedRoutesPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { initiateCall } = useCall();
  const { routes, isLoading, error } = useMyAssignedRoutes();

  const completeStop = useMutation({
    mutationFn: async (stop: CanonicalRouteStop) => {
      const { error: updateError } = await supabase
        .from('route_stops')
        .update({ status: 'completed', actual_arrival: new Date().toISOString() })
        .eq('id', stop.id)
        .eq('route_id', stop.route_id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Stop completed');
      queryClient.invalidateQueries({ queryKey: ['my-assigned-routes'] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || 'Failed to complete stop');
    },
  });

  const visibleRoutes = useMemo(
    () => [...routes].sort((a, b) => a.date.localeCompare(b.date)),
    [routes],
  );

  const formatAddress = (stop: CanonicalRouteStop) => stop.store.address || 'Address unavailable';

  const openNavigation = (stop: CanonicalRouteStop) => {
    const destination = stop.store.address;
    if (!destination) {
      toast.error('This store does not have an address for navigation');
      return;
    }
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const callStore = (stop: CanonicalRouteStop) => {
    if (!stop.store.phone) return;
    initiateCall({
      destinationPhone: stop.store.phone,
      entityType: 'store',
      entityId: stop.store.id,
      entityName: stop.store.store_name,
    });
  };

  const openVisit = (stop: CanonicalRouteStop) => {
    navigate(`/portal/${portalType}/visit/${stop.store_id}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading assigned routes...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Routes could not be loaded</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <RouteIcon className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">My Routes</h1>
          <p className="text-sm text-muted-foreground">Routes assigned to you from dispatch</p>
        </div>
      </div>

      {visibleRoutes.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-12 text-center">
            <RouteIcon className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No routes assigned</p>
            <p className="text-sm text-muted-foreground">
              When dispatch assigns a route to you, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        visibleRoutes.map((route) => {
          const completed = route.stops.filter((stop) => isFinished(stop.status)).length;
          return (
            <Card key={route.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {route.name || route.territory || `Route ${route.id.slice(0, 8)}`}
                      <Badge variant="outline">{route.status}</Badge>
                    </CardTitle>
                    <CardDescription>
                      {format(new Date(`${route.date}T00:00:00`), 'EEE, MMM d, yyyy')} · {route.type || 'route'} · {completed}/{route.stops.length} stops
                    </CardDescription>
                  </div>
                  {route.territory && route.name && (
                    <Badge variant="secondary">{route.territory}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {route.stops.length === 0 ? (
                  <p className="py-6 text-center text-sm italic text-muted-foreground">No stops on this route.</p>
                ) : (
                  route.stops.map((stop) => {
                    const finished = isFinished(stop.status);
                    return (
                      <div key={stop.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {finished ? <CheckCircle2 className="h-4 w-4" /> : stop.planned_order}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-medium">
                              <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{stop.store.store_name}</span>
                            </div>
                            <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>{formatAddress(stop)}</span>
                            </div>
                            {stop.notes_to_worker && (
                              <p className="mt-1 text-xs italic text-muted-foreground">{stop.notes_to_worker}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          <Badge variant={finished ? 'secondary' : 'outline'}>
                            {stop.status === 'pending' ? <Clock className="mr-1 h-3 w-3" /> : null}
                            {stop.status}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => openNavigation(stop)}>
                            <Navigation className="mr-1 h-3 w-3" />
                            Navigate
                          </Button>
                          {stop.store.phone && (
                            <Button size="sm" variant="outline" onClick={() => callStore(stop)}>
                              <Phone className="mr-1 h-3 w-3" />
                              Call
                            </Button>
                          )}
                          <Button size="sm" onClick={() => openVisit(stop)}>
                            <Store className="mr-1 h-3 w-3" />
                            Visit
                          </Button>
                          {!finished && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => completeStop.mutate(stop)}
                              disabled={completeStop.isPending}
                            >
                              {completeStop.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Complete'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
