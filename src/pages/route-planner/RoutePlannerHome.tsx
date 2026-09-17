import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, Navigation, Loader2, LogOut, CheckCircle2, SkipForward, Flag } from 'lucide-react';

type StopStatus = 'planned' | 'visited' | 'skipped' | 'needs_review';

const STATUS_LABEL: Record<StopStatus, string> = {
  planned: 'Planned',
  visited: 'Visited',
  skipped: 'Skipped',
  needs_review: 'Needs Review',
};

const STATUS_CLASS: Record<StopStatus, string> = {
  planned: 'bg-muted text-muted-foreground',
  visited: 'bg-primary/15 text-primary',
  skipped: 'bg-destructive/15 text-destructive',
  needs_review: 'bg-amber-500/15 text-amber-500',
};

function normalizeStatus(value: string | null): StopStatus {
  const v = (value || 'planned').toLowerCase();
  if (v === 'visited' || v === 'completed') return 'visited';
  if (v === 'skipped' || v === 'cancelled') return 'skipped';
  if (v === 'needs_review') return 'needs_review';
  return 'planned';
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function RoutePlannerHome() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | StopStatus>('all');

  const routesQuery = useQuery({
    queryKey: ['route-planner-routes', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, name, date, status, territory, is_trial, total_stops')
        .eq('assigned_to', user!.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const activeRouteId = routeId ?? routesQuery.data?.[0]?.id ?? null;
  const activeRoute = routesQuery.data?.find((r: any) => r.id === activeRouteId) || null;

  const stopsQuery = useQuery({
    queryKey: ['route-planner-stops', activeRouteId],
    enabled: !!activeRouteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_stops')
        .select('id, planned_order, status, address, zip, area, notes')
        .eq('route_id', activeRouteId!)
        .order('planned_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StopStatus }) => {
      const { error } = await supabase.from('route_stops').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['route-planner-stops', activeRouteId] }),
    onError: (e: any) => toast.error(e?.message || 'Could not update this stop'),
  });

  const stops = (stopsQuery.data || []) as any[];
  const counts = useMemo(() => {
    const c = { total: stops.length, visited: 0, skipped: 0, needs_review: 0, planned: 0 };
    stops.forEach((s) => { c[normalizeStatus(s.status)] += 1; });
    return c;
  }, [stops]);

  const nextStop = stops.find((s) => normalizeStatus(s.status) === 'planned') || null;
  const visibleStops = filter === 'all' ? stops : stops.filter((s) => normalizeStatus(s.status) === filter);

  if (routesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if ((routesQuery.data || []).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <MapPin className="h-10 w-10 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">No route access</h1>
            <p className="text-sm text-muted-foreground">
              This account has no route assigned to it. Ask your GasMask contact to assign a route,
              then reopen the Route Planner.
            </p>
            <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-10">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <MapPin className="h-5 w-5 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight truncate">GasMask Route Planner</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {(routesQuery.data || []).length > 1 && (
          <Select value={activeRouteId ?? undefined} onValueChange={setRouteId}>
            <SelectTrigger><SelectValue placeholder="Choose a route" /></SelectTrigger>
            <SelectContent>
              {(routesQuery.data || []).map((r: any) => (
                <SelectItem key={r.id} value={r.id}>{r.name || `Route ${r.date}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold leading-tight">{activeRoute?.name || 'Route'}</h1>
                <p className="text-xs text-muted-foreground">
                  {activeRoute?.territory || 'Route'} · {counts.total} stops
                </p>
              </div>
              {activeRoute?.is_trial && <Badge variant="secondary">TRIAL</Badge>}
            </div>

            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${counts.total ? ((counts.visited + counts.skipped) / counts.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {counts.visited} visited · {counts.skipped} skipped · {counts.needs_review} needs review ·{' '}
              {counts.planned} remaining
            </p>

            {nextStop && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Next stop</p>
                <p className="font-medium leading-snug break-words">
                  #{nextStop.planned_order} · {nextStop.address}
                </p>
                <Button asChild className="w-full h-11">
                  <a href={mapsUrl(nextStop.address)} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-4 w-4 mr-2" /> Navigate
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'planned', 'visited', 'skipped', 'needs_review'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="shrink-0"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
            </Button>
          ))}
        </div>

        {stopsQuery.isLoading ? (
          <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {visibleStops.map((stop) => {
              const status = normalizeStatus(stop.status);
              return (
                <Card key={stop.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          Stop {stop.planned_order} · {stop.area || '—'} · {stop.zip || '—'}
                        </p>
                        <p className="font-medium leading-snug break-words">{stop.address}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </div>

                    <Button asChild variant="outline" className="w-full h-11">
                      <a href={mapsUrl(stop.address)} target="_blank" rel="noopener noreferrer">
                        <Navigation className="h-4 w-4 mr-2" /> Open in Maps
                      </a>
                    </Button>

                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant={status === 'visited' ? 'default' : 'outline'}
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: stop.id, status: 'visited' })}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Visited
                      </Button>
                      <Button
                        size="sm"
                        variant={status === 'skipped' ? 'default' : 'outline'}
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: stop.id, status: 'skipped' })}
                      >
                        <SkipForward className="h-4 w-4 mr-1" /> Skip
                      </Button>
                      <Button
                        size="sm"
                        variant={status === 'needs_review' ? 'default' : 'outline'}
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: stop.id, status: 'needs_review' })}
                      >
                        <Flag className="h-4 w-4 mr-1" /> Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
