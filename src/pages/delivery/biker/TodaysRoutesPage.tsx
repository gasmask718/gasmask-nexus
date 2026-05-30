import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Route as RouteIcon, MapPin, Store, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

/**
 * Biker "Today's Routes" — mirrors the proven Driver pattern:
 *   routes WHERE assigned_to = auth.uid()
 *     → route_stops (planned_order)
 *       → store_master (name + address)
 *
 * No type filter. Any route dispatched to this biker shows here.
 * Stop completion writes route_stops.status = 'completed'.
 */
export default function TodaysRoutesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['biker-assigned-routes', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          id, name, date, type, status, territory, source, total_stops,
          route_stops (
            id, planned_order, status, notes_to_worker, actual_arrival, store_id
          )
        `)
        .eq('assigned_to', user!.id)
        .order('date', { ascending: false });
      if (error) throw error;

      const routesData = data || [];
      const storeIds = Array.from(
        new Set(routesData.flatMap((r: any) => (r.route_stops || []).map((s: any) => s.store_id)))
      );

      let storeMap: Record<string, { store_name: string; address: string | null; city: string | null; state: string | null }> = {};
      if (storeIds.length > 0) {
        const { data: stores } = await supabase
          .from('store_master')
          .select('id, store_name, address, city, state')
          .in('id', storeIds);
        storeMap = Object.fromEntries((stores || []).map((s: any) => [s.id, s]));
      }

      return routesData.map((r: any) => ({
        ...r,
        route_stops: (r.route_stops || [])
          .map((s: any) => ({ ...s, store: storeMap[s.store_id] || null }))
          .sort((a: any, b: any) => (a.planned_order ?? 0) - (b.planned_order ?? 0)),
      }));
    },
  });

  const completeStop = useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase
        .from('route_stops')
        .update({ status: 'completed', actual_arrival: new Date().toISOString() })
        .eq('id', stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Stop completed');
      queryClient.invalidateQueries({ queryKey: ['biker-assigned-routes', user?.id] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to complete stop'),
  });

  const formatAddress = (store: any) => {
    if (!store) return 'Unknown address';
    return [store.address, store.city, store.state].filter(Boolean).join(', ') || 'No address';
  };

  const routeStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
      active: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
      in_progress: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
      completed: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
    };
    return <Badge className={map[status] || ''} variant="outline">{status}</Badge>;
  };

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/biker/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RouteIcon className="h-6 w-6 text-primary" />
            My Routes
          </h1>
          <p className="text-sm text-muted-foreground">All routes assigned to you</p>
        </div>
      </div>

      {isLoading && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" /> Loading routes…
        </CardContent></Card>
      )}

      {!isLoading && routes.length === 0 && (
        <Card><CardContent className="p-10 text-center space-y-2">
          <RouteIcon className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-medium">No routes assigned</p>
          <p className="text-sm text-muted-foreground">
            When a dispatcher assigns a route to you, it will show here.
          </p>
        </CardContent></Card>
      )}

      {routes.map((route: any) => {
        const stops = route.route_stops || [];
        const completed = stops.filter((s: any) => s.status === 'completed').length;
        return (
          <Card key={route.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {route.name || `Route ${route.id.slice(0, 8)}`}
                    {routeStatusBadge(route.status)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {route.date ? format(new Date(route.date), 'EEE, MMM d, yyyy') : ''} · {route.type || 'route'} · {completed}/{stops.length} stops
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">{route.source}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {stops.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No stops on this route.</p>
              ) : (
                stops.map((stop: any) => (
                  <div
                    key={stop.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                        {stop.planned_order}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                          {stop.store?.store_name || 'Unknown store'}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {formatAddress(stop.store)}
                        </div>
                        {stop.notes_to_worker && (
                          <p className="text-xs mt-1 italic text-muted-foreground">{stop.notes_to_worker}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {stop.status === 'completed' ? (
                        <Badge variant="outline" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => completeStop.mutate(stop.id)}
                          disabled={completeStop.isPending}
                        >
                          {completeStop.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Complete'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
