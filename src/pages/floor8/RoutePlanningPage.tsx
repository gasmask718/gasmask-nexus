/**
 * Central Route Planning (manager view) — GasMask / company field ambassador operation.
 *
 * Reuses the EXISTING canonical system only:
 *   ambassadors → ambassador_assignments → routes / route_stops → canonical `stores`.
 * No duplicate roster, no second assignment table, no second routing engine.
 *
 * Rules preserved:
 *  - duplicate ACTIVE assignments impossible (pre-check + DB partial unique index)
 *  - removal is a SOFT unassign (active=false + unassigned_at) so history survives
 *  - coordinates are never invented; stores without lat/lng are flagged for geocoding
 *  - ambassadors keep their own worker-scoped view; nothing here widens their access
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Loader2, MapPin, Route as RouteIcon,
  Search, Store as StoreIcon, UserX, X,
} from 'lucide-react';
import { AmbassadorStoreMap, type MapStore } from '@/components/ambassador/AmbassadorStoreMap';

const today = () => format(new Date(), 'yyyy-MM-dd');
const DONE = new Set(['complete', 'completed', 'skipped', 'done']);

interface RosterRow {
  id: string;
  name: string;
  user_id: string | null;
  state: string | null;
  assignedCount: number;
  routeCount: number;
  latestRoute: { date: string; status: string } | null;
}

interface PlanStore {
  store_id: string;
  assignment_id?: string;
  name: string;
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

interface RouteRow {
  id: string;
  date: string;
  name: string | null;
  status: string;
  stops: { id: string; store_id: string | null; planned_order: number | null; status: string | null }[];
}

const storeAddress = (s: any) =>
  [s?.address_street, s?.address_city, s?.address_state, s?.address_zip].filter(Boolean).join(', ');

export default function RoutePlanningPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');

  // planning filters
  const [storeSearch, setStoreSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [assignFilter, setAssignFilter] = useState<'all' | 'assigned' | 'unassigned'>('unassigned');
  const [geoFilter, setGeoFilter] = useState<'all' | 'mapped' | 'missing'>('all');
  const [routeStatusFilter, setRouteStatusFilter] = useState<string>('all');

  // route builder state
  const [picked, setPicked] = useState<string[]>([]);
  const [plan, setPlan] = useState<string[]>([]);
  const [routeDate, setRouteDate] = useState(today());
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

  /* ------------------------------------------------ roster */
  const rosterQuery = useQuery({
    queryKey: ['rp-roster'],
    queryFn: async (): Promise<RosterRow[]> => {
      const { data: ambs, error } = await supabase
        .from('ambassadors')
        .select('id, name, user_id, state')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;

      const ids = (ambs || []).map((a: any) => a.id);
      const { data: assigns, error: aErr } = await supabase
        .from('ambassador_assignments')
        .select('ambassador_id')
        .eq('active', true)
        .not('store_id', 'is', null)
        .in('ambassador_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      if (aErr) throw aErr;

      const userIds = (ambs || []).map((a: any) => a.user_id).filter(Boolean) as string[];
      const { data: routes, error: rErr } = userIds.length
        ? await supabase
            .from('routes')
            .select('id, date, status, assigned_to')
            .in('assigned_to', userIds)
            .order('date', { ascending: false })
        : { data: [] as any[], error: null as any };
      if (rErr) throw rErr;

      const count = new Map<string, number>();
      (assigns || []).forEach((a: any) => count.set(a.ambassador_id, (count.get(a.ambassador_id) || 0) + 1));

      return (ambs || []).map((a: any) => {
        const mine = (routes || []).filter((r: any) => r.assigned_to === a.user_id);
        return {
          id: a.id,
          name: a.name || 'Unnamed ambassador',
          user_id: a.user_id,
          state: a.state,
          assignedCount: count.get(a.id) || 0,
          routeCount: mine.length,
          latestRoute: mine[0] ? { date: mine[0].date, status: mine[0].status } : null,
        };
      });
    },
  });

  const roster = rosterQuery.data || [];
  const selected = roster.find((r) => r.id === selectedId) || null;
  const missingLogin = roster.filter((r) => !r.user_id);
  const filteredRoster = roster.filter((r) => r.name.toLowerCase().includes(rosterSearch.toLowerCase()));

  /* ------------------------------------------------ global operation counts */
  const globalsQuery = useQuery({
    queryKey: ['rp-globals'],
    queryFn: async () => {
      const { data: assigned, error: aErr } = await supabase
        .from('ambassador_assignments')
        .select('store_id')
        .eq('active', true)
        .not('store_id', 'is', null);
      if (aErr) throw aErr;
      const assignedIds = new Set((assigned || []).map((a: any) => a.store_id));

      const { count: totalStores, error: tErr } = await supabase
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);
      if (tErr) throw tErr;

      const { count: missingCoords, error: mErr } = await supabase
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .or('lat.is.null,lng.is.null');
      if (mErr) throw mErr;

      return {
        activeAssignments: assignedIds.size,
        totalStores: totalStores || 0,
        unassignedStores: Math.max((totalStores || 0) - assignedIds.size, 0),
        missingCoords: missingCoords || 0,
      };
    },
  });
  const globals = globalsQuery.data;

  /* ------------------------------------------------ assigned stores for selection */
  const assignedQuery = useQuery({
    queryKey: ['rp-assigned', selectedId],
    enabled: !!selectedId,
    queryFn: async (): Promise<PlanStore[]> => {
      const { data, error } = await supabase
        .from('ambassador_assignments')
        .select('id, store_id')
        .eq('ambassador_id', selectedId!)
        .eq('active', true)
        .not('store_id', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = (data || []).map((a: any) => a.store_id);
      if (!ids.length) return [];
      const { data: stores, error: sErr } = await supabase
        .from('stores')
        .select('id, name, address_street, address_city, address_state, address_zip, lat, lng')
        .in('id', ids);
      if (sErr) throw sErr;
      const sMap = new Map((stores || []).map((s: any) => [s.id, s]));

      return (data || []).map((a: any) => {
        const s = sMap.get(a.store_id);
        return {
          store_id: a.store_id,
          assignment_id: a.id,
          name: s?.name || 'Unknown store',
          address: storeAddress(s) || 'No address on file',
          city: s?.address_city ?? null,
          lat: s?.lat ?? null,
          lng: s?.lng ?? null,
        };
      });
    },
  });
  const assigned = assignedQuery.data || [];
  const assignedIds = useMemo(() => assigned.map((a) => a.store_id), [assigned]);

  /* ------------------------------------------------ canonical store pool (planning list) */
  const poolQuery = useQuery({
    queryKey: ['rp-pool', storeSearch, cityFilter, geoFilter, assignFilter],
    queryFn: async () => {
      let q = supabase
        .from('stores')
        .select('id, name, address_street, address_city, address_state, address_zip, lat, lng')
        .is('deleted_at', null)
        .order('name')
        .limit(150);
      if (storeSearch.trim()) q = q.or(`name.ilike.%${storeSearch.trim()}%,address_street.ilike.%${storeSearch.trim()}%`);
      if (cityFilter.trim()) q = q.ilike('address_city', `%${cityFilter.trim()}%`);
      if (geoFilter === 'missing') q = q.or('lat.is.null,lng.is.null');
      if (geoFilter === 'mapped') q = q.not('lat', 'is', null).not('lng', 'is', null);
      const { data, error } = await q;
      if (error) throw error;

      const ids = (data || []).map((s: any) => s.id);
      let assignedSet = new Set<string>();
      if (ids.length) {
        const { data: aRows, error: aErr } = await supabase
          .from('ambassador_assignments')
          .select('store_id')
          .eq('active', true)
          .in('store_id', ids);
        if (aErr) throw aErr;
        assignedSet = new Set((aRows || []).map((r: any) => r.store_id));
      }

      return (data || []).map((s: any) => ({
        store_id: s.id,
        name: s.name || 'Unnamed store',
        address: storeAddress(s) || 'No address on file',
        city: s.address_city ?? null,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        isAssigned: assignedSet.has(s.id),
      }));
    },
  });

  const pool = (poolQuery.data || []).filter((s) =>
    assignFilter === 'all' ? true : assignFilter === 'assigned' ? s.isAssigned : !s.isAssigned,
  );

  /* ------------------------------------------------ routes for selected ambassador */
  const routesQuery = useQuery({
    queryKey: ['rp-routes', selected?.user_id],
    enabled: !!selected?.user_id,
    queryFn: async (): Promise<RouteRow[]> => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, date, name, status')
        .eq('assigned_to', selected!.user_id!)
        .order('date', { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.id);
      let stops: any[] = [];
      if (ids.length) {
        const { data: s, error: sErr } = await supabase
          .from('route_stops')
          .select('id, route_id, store_id, planned_order, status')
          .in('route_id', ids)
          .order('planned_order');
        if (sErr) throw sErr;
        stops = s || [];
      }
      return (data || []).map((r: any) => ({
        ...r,
        stops: stops.filter((s) => s.route_id === r.id),
      }));
    },
  });
  const routes = (routesQuery.data || []).filter(
    (r) => routeStatusFilter === 'all' || r.status === routeStatusFilter,
  );

  /* ------------------------------------------------ mutations */
  const assignMutation = useMutation({
    mutationFn: async (storeIds: string[]) => {
      if (!selectedId) throw new Error('Pick an ambassador first');
      const { data: current, error: cErr } = await supabase
        .from('ambassador_assignments')
        .select('store_id')
        .eq('ambassador_id', selectedId)
        .eq('active', true)
        .in('store_id', storeIds);
      if (cErr) throw cErr;
      const already = new Set((current || []).map((r: any) => r.store_id));
      const toInsert = storeIds.filter((id) => !already.has(id));
      if (!toInsert.length) throw new Error('Those stores are already assigned to this ambassador');
      const { error } = await supabase.from('ambassador_assignments').insert(
        toInsert.map((store_id) => ({
          ambassador_id: selectedId,
          store_id,
          assignment_type: 'assigned',
          assignment_role: 'assigned',
          active: true,
          start_date: today(),
          created_by: user?.id ?? null,
        })),
      );
      if (error) throw error;
      return { inserted: toInsert.length, skipped: storeIds.length - toInsert.length };
    },
    onSuccess: ({ inserted, skipped }) => {
      toast.success(`${inserted} store${inserted === 1 ? '' : 's'} assigned${skipped ? ` · ${skipped} already assigned` : ''}`);
      setPicked([]);
      qc.invalidateQueries({ queryKey: ['rp-assigned', selectedId] });
      qc.invalidateQueries({ queryKey: ['rp-roster'] });
      qc.invalidateQueries({ queryKey: ['rp-pool'] });
      qc.invalidateQueries({ queryKey: ['rp-globals'] });
    },
    onError: (e: any) => toast.error(e.message || 'Assignment failed'),
  });

  const unassignMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('ambassador_assignments')
        .update({
          active: false,
          end_date: today(),
          unassigned_at: new Date().toISOString(),
          unassigned_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Store unassigned — assignment history kept');
      qc.invalidateQueries({ queryKey: ['rp-assigned', selectedId] });
      qc.invalidateQueries({ queryKey: ['rp-roster'] });
      qc.invalidateQueries({ queryKey: ['rp-pool'] });
      qc.invalidateQueries({ queryKey: ['rp-globals'] });
    },
    onError: (e: any) => toast.error(e.message || 'Unassign failed'),
  });

  const saveRouteMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Pick an ambassador first');
      if (!selected.user_id) throw new Error('This ambassador has no login yet — a route cannot be delivered to them');
      if (!plan.length) throw new Error('Add at least one assigned store to the route');

      let routeId = editingRouteId;
      if (routeId) {
        const { error } = await supabase
          .from('routes')
          .update({ date: routeDate, total_stops: plan.length })
          .eq('id', routeId);
        if (error) throw error;
        const { error: dErr } = await supabase.from('route_stops').delete().eq('route_id', routeId);
        if (dErr) throw dErr;
      } else {
        const { data: route, error } = await supabase
          .from('routes')
          .insert({
            date: routeDate,
            territory: `${selected.name} — ${routeDate}`,
            name: `${selected.name} — ${routeDate}`,
            status: 'planned',
            type: 'ambassador',
            assigned_to: selected.user_id,
            created_by: user?.id ?? null,
            total_stops: plan.length,
          })
          .select('id')
          .single();
        if (error) throw error;
        routeId = route.id as string;
      }

      const { error: sErr } = await supabase.from('route_stops').insert(
        plan.map((store_id, i) => ({
          route_id: routeId,
          store_id,
          planned_order: i + 1,
          status: 'planned',
        })),
      );
      if (sErr) throw sErr;
      return routeId as string;
    },
    onSuccess: (routeId) => {
      toast.success(editingRouteId ? 'Route updated' : 'Route created');
      setEditingRouteId(routeId);
      qc.invalidateQueries({ queryKey: ['rp-routes', selected?.user_id] });
      qc.invalidateQueries({ queryKey: ['rp-roster'] });
    },
    onError: (e: any) => toast.error(e.message || 'Route save failed'),
  });

  const markReadyMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase.from('routes').update({ status: 'scheduled' }).eq('id', routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Route marked ready for field work');
      qc.invalidateQueries({ queryKey: ['rp-routes', selected?.user_id] });
      qc.invalidateQueries({ queryKey: ['rp-roster'] });
    },
    onError: (e: any) => toast.error(e.message || 'Could not mark route ready'),
  });

  /* ------------------------------------------------ derived */
  useEffect(() => {
    setPlan([]);
    setEditingRouteId(null);
    setPicked([]);
  }, [selectedId]);

  const assignedMap = useMemo(() => new Map(assigned.map((a) => [a.store_id, a])), [assigned]);
  const planStores = plan.map((id) => assignedMap.get(id)).filter(Boolean) as PlanStore[];
  const needGeocode = assigned.filter((a) => a.lat == null || a.lng == null);

  const mapStores: MapStore[] = useMemo(() => {
    const source = planStores.length ? planStores : assigned;
    return source.map((s, i) => ({
      id: s.store_id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      statusKey: planStores.length ? 'planned' : 'assigned',
      order: planStores.length ? i + 1 : undefined,
    }));
  }, [planStores, assigned]);

  const move = (idx: number, dir: -1 | 1) =>
    setPlan((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const loadRouteIntoPlan = (r: RouteRow) => {
    setEditingRouteId(r.id);
    setRouteDate(r.date);
    setPlan(
      [...r.stops]
        .sort((a, b) => (a.planned_order || 0) - (b.planned_order || 0))
        .map((s) => s.store_id)
        .filter((id): id is string => !!id && assignedMap.has(id)),
    );
  };

  /* ------------------------------------------------ render */
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <RouteIcon className="h-6 w-6" /> Route Planning
        </h1>
        <p className="text-sm text-muted-foreground">
          Plan the whole field operation from the existing roster, assignments, stores and routes.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Active ambassadors</p>
          <p className="text-2xl font-bold">{roster.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Missing a login</p>
          <p className="text-2xl font-bold text-amber-500">{missingLogin.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Assigned stores</p>
          <p className="text-2xl font-bold">{globals?.activeAssignments ?? '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Unassigned stores</p>
          <p className="text-2xl font-bold">{globals?.unassignedStores ?? '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Missing coordinates</p>
          <p className="text-2xl font-bold text-amber-500">{globals?.missingCoords ?? '—'}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roster */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Field ambassadors</CardTitle>
            <CardDescription>Pick who you are planning for</CardDescription>
            <div className="relative pt-2">
              <Search className="absolute left-2 top-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search ambassadors"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {rosterQuery.isLoading ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : (
              <ScrollArea className="h-[600px] pr-2">
                <div className="space-y-2">
                  {filteredRoster.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedId === r.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{r.name}</span>
                        <Badge variant="secondary">{r.assignedCount} stores</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {r.user_id ? (
                          <Badge variant="outline" className="text-xs">ready</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                            <UserX className="h-3 w-3 mr-1" /> no login
                          </Badge>
                        )}
                        <span>{r.routeCount} route{r.routeCount === 1 ? '' : 's'}</span>
                        {r.latestRoute && <span>· latest {r.latestRoute.status}</span>}
                      </div>
                    </button>
                  ))}
                  {!filteredRoster.length && (
                    <p className="text-sm text-muted-foreground py-6 text-center">No ambassadors match.</p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Planner */}
        <div className="lg:col-span-2 space-y-6">
          {!selected ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              Select an ambassador to start planning.
            </CardContent></Card>
          ) : (
            <>
              {!selected.user_id && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <span>
                    <strong>{selected.name}</strong> has no login linked. Stores can be assigned, but a route
                    cannot be delivered to them until a login exists.
                  </span>
                </div>
              )}

              <Tabs defaultValue="stores">
                <TabsList>
                  <TabsTrigger value="stores">Stores</TabsTrigger>
                  <TabsTrigger value="route">Route builder</TabsTrigger>
                  <TabsTrigger value="routes">Routes ({routes.length})</TabsTrigger>
                  <TabsTrigger value="map">Map</TabsTrigger>
                </TabsList>

                {/* ---------------- stores ---------------- */}
                <TabsContent value="stores" className="space-y-4 pt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Assigned to {selected.name}</CardTitle>
                      <CardDescription>
                        {assigned.length} active
                        {needGeocode.length > 0 && ` · ${needGeocode.length} need geocoding`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {assignedQuery.isLoading ? (
                        <Skeleton className="h-24 w-full" />
                      ) : !assigned.length ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No active store assignments.</p>
                      ) : (
                        <div className="space-y-2">
                          {assigned.map((a) => (
                            <div key={a.assignment_id} className="flex items-start gap-3 p-3 rounded-lg border">
                              <Checkbox
                                checked={plan.includes(a.store_id)}
                                onCheckedChange={(v) =>
                                  setPlan((prev) => (v ? [...prev, a.store_id] : prev.filter((x) => x !== a.store_id)))
                                }
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{a.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{a.address}</p>
                                {(a.lat == null || a.lng == null) && (
                                  <Badge variant="outline" className="mt-1 text-xs text-amber-500 border-amber-500/40">
                                    needs geocoding
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => unassignMutation.mutate(a.assignment_id!)}
                                disabled={unassignMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Canonical store book</CardTitle>
                      <CardDescription>Assign one or many stores to {selected.name}</CardDescription>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2">
                        <Input placeholder="Search store" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} />
                        <Input placeholder="City / territory" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
                        <Select value={assignFilter} onValueChange={(v: any) => setAssignFilter(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned only</SelectItem>
                            <SelectItem value="assigned">Assigned only</SelectItem>
                            <SelectItem value="all">All stores</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={geoFilter} onValueChange={(v: any) => setGeoFilter(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any coordinates</SelectItem>
                            <SelectItem value="mapped">Mapped only</SelectItem>
                            <SelectItem value="missing">Missing coordinates</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {poolQuery.isLoading ? (
                        <Skeleton className="h-40 w-full" />
                      ) : (
                        <ScrollArea className="h-[320px] pr-2">
                          <div className="space-y-2">
                            {pool.map((s) => {
                              const mine = assignedIds.includes(s.store_id);
                              return (
                                <label
                                  key={s.store_id}
                                  className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40"
                                >
                                  <Checkbox
                                    checked={picked.includes(s.store_id)}
                                    disabled={mine}
                                    onCheckedChange={(v) =>
                                      setPicked((prev) => (v ? [...prev, s.store_id] : prev.filter((x) => x !== s.store_id)))
                                    }
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{s.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{s.address}</p>
                                    <div className="flex gap-2 mt-1">
                                      {mine && <Badge variant="secondary" className="text-xs">already yours</Badge>}
                                      {!mine && s.isAssigned && <Badge variant="outline" className="text-xs">assigned elsewhere</Badge>}
                                      {(s.lat == null || s.lng == null) && (
                                        <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                                          needs geocoding
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                            {!pool.length && (
                              <p className="text-sm text-muted-foreground py-6 text-center">No stores match these filters.</p>
                            )}
                          </div>
                        </ScrollArea>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{picked.length} selected</span>
                        <Button
                          disabled={!picked.length || assignMutation.isPending}
                          onClick={() => assignMutation.mutate(picked)}
                        >
                          {assignMutation.isPending
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <StoreIcon className="h-4 w-4 mr-2" />}
                          Assign to {selected.name}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ---------------- route builder ---------------- */}
                <TabsContent value="route" className="space-y-4 pt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">
                        {editingRouteId ? 'Update route' : 'Build a new route'}
                      </CardTitle>
                      <CardDescription>
                        Stops come from {selected.name}'s assigned stores. Order them, then save.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <Label className="text-xs">Route date</Label>
                          <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} />
                        </div>
                        {editingRouteId && (
                          <Button variant="outline" onClick={() => { setEditingRouteId(null); setPlan([]); }}>
                            Start a new route instead
                          </Button>
                        )}
                      </div>

                      {!planStores.length ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                          Tick assigned stores on the Stores tab to add them as stops.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {planStores.map((s, i) => (
                            <div key={s.store_id} className="flex items-center gap-3 p-3 rounded-lg border">
                              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{s.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{s.address}</p>
                              </div>
                              {(s.lat == null || s.lng == null) && (
                                <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                                  no pin
                                </Badge>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}>
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === planStores.length - 1}>
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setPlan((p) => p.filter((x) => x !== s.store_id))}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{planStores.length} stops</span>
                        <Button
                          disabled={!planStores.length || !selected.user_id || saveRouteMutation.isPending}
                          onClick={() => saveRouteMutation.mutate()}
                        >
                          {saveRouteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          {editingRouteId ? 'Save route changes' : 'Create route'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <AmbassadorStoreMap stores={mapStores} title="Planned route" height={420} />
                </TabsContent>

                {/* ---------------- existing routes ---------------- */}
                <TabsContent value="routes" className="space-y-4 pt-4">
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Routes for {selected.name}</CardTitle>
                        <CardDescription>Stop counts come from route_stops</CardDescription>
                      </div>
                      <Select value={routeStatusFilter} onValueChange={setRouteStatusFilter}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="scheduled">Ready / scheduled</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardHeader>
                    <CardContent>
                      {routesQuery.isLoading ? (
                        <Skeleton className="h-24 w-full" />
                      ) : !routes.length ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                          {selected.user_id ? 'No routes match.' : 'No login yet, so no routes can exist.'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {routes.map((r) => {
                            const done = r.stops.filter((s) => DONE.has((s.status || '').toLowerCase())).length;
                            return (
                              <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{r.name || r.date}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {r.date} · {r.stops.length} stops · {done} done · {r.stops.length - done} remaining
                                  </p>
                                </div>
                                <Badge variant={r.status === 'scheduled' ? 'default' : 'secondary'}>{r.status}</Badge>
                                <Button size="sm" variant="outline" onClick={() => loadRouteIntoPlan(r)}>Edit stops</Button>
                                {r.status !== 'scheduled' && (
                                  <Button
                                    size="sm"
                                    disabled={markReadyMutation.isPending || !r.stops.length}
                                    onClick={() => markReadyMutation.mutate(r.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Mark ready
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ---------------- map ---------------- */}
                <TabsContent value="map" className="pt-4">
                  <AmbassadorStoreMap
                    stores={mapStores}
                    title={`${selected.name} — real store pins`}
                    height={520}
                  />
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Pins use canonical stores.lat/lng only — nothing is invented.
                  </p>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
