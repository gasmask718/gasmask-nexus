/**
 * Ambassador Assignments & Routes (manager view)
 *
 * Reuses the EXISTING system only:
 *   ambassadors → ambassador_assignments → routes / route_stops → canonical stores.
 * No second roster, no second assignment table, no second routing system.
 *
 * Rules enforced here:
 *  - duplicate ACTIVE assignments are impossible (partial unique index + pre-filter)
 *  - removal is a soft unassign (active=false + unassigned_at) so history is preserved
 *  - coordinates are never invented; stores without lat/lng are flagged for geocoding
 */
import { useMemo, useState } from 'react';
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle, Loader2, MapPin, Route as RouteIcon, Search, Store, UserX, X,
} from 'lucide-react';
import { AmbassadorStoreMap, type MapStore } from '@/components/ambassador/AmbassadorStoreMap';

type Readiness = 'ready' | 'login_required' | 'shared_login_conflict';

interface RosterRow {
  id: string;
  name: string;
  user_id: string | null;
  is_active: boolean;
  tier: string | null;
  state: string | null;
  phone_primary: string | null;
  assignedCount: number;
  routeCount: number;
  latestRoute: { date: string; status: string } | null;
  readiness: Readiness;
  sharedWith: number;
}

const READINESS_LABEL: Record<Readiness, string> = {
  ready: 'Ready',
  login_required: 'Login Required',
  shared_login_conflict: 'Shared Login Conflict',
};
const READINESS_CLASS: Record<Readiness, string> = {
  ready: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  login_required: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  shared_login_conflict: 'bg-destructive/15 text-destructive border-destructive/30',
};

const today = () => format(new Date(), 'yyyy-MM-dd');

export default function AmbassadorAssignmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [pickedStores, setPickedStores] = useState<string[]>([]);
  const [routeStores, setRouteStores] = useState<string[]>([]);
  const [routeDate, setRouteDate] = useState(today());

  /* ---------------- roster ---------------- */
  const rosterQuery = useQuery({
    queryKey: ['amb-assign-roster'],
    queryFn: async (): Promise<RosterRow[]> => {
      const { data: ambs, error } = await supabase
        .from('ambassadors')
        .select('id, name, user_id, is_active, tier, state, phone_primary')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;

      const ids = (ambs || []).map((a) => a.id);
      const { data: assigns, error: aErr } = await supabase
        .from('ambassador_assignments')
        .select('ambassador_id')
        .eq('active', true)
        .not('store_id', 'is', null)
        .in('ambassador_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      if (aErr) throw aErr;

      const userIds = (ambs || []).map((a) => a.user_id).filter(Boolean) as string[];
      const { data: routes, error: rErr } = userIds.length
        ? await supabase
            .from('routes')
            .select('id, date, status, assigned_to')
            .in('assigned_to', userIds)
            .order('date', { ascending: false })
        : { data: [], error: null as any };
      if (rErr) throw rErr;

      const { data: readiness, error: readyErr } = await (supabase as any)
        .from('v_ambassador_login_readiness')
        .select('ambassador_id, readiness, logins_shared_with');
      if (readyErr) throw readyErr;
      const readyMap = new Map<string, { readiness: Readiness; sharedWith: number }>();
      (readiness || []).forEach((r: any) =>
        readyMap.set(r.ambassador_id, {
          readiness: r.readiness as Readiness,
          sharedWith: Number(r.logins_shared_with || 0),
        }),
      );

      const assignCount = new Map<string, number>();
      (assigns || []).forEach((a: any) =>
        assignCount.set(a.ambassador_id, (assignCount.get(a.ambassador_id) || 0) + 1),
      );

      return (ambs || []).map((a: any) => {
        const mine = (routes || []).filter((r: any) => r.assigned_to === a.user_id);
        const rd = readyMap.get(a.id);
        return {
          ...a,
          name: a.name || 'Unnamed ambassador',
          assignedCount: assignCount.get(a.id) || 0,
          routeCount: mine.length,
          latestRoute: mine[0] ? { date: mine[0].date, status: mine[0].status } : null,
          readiness: rd?.readiness ?? (a.user_id ? 'ready' : 'login_required'),
          sharedWith: rd?.sharedWith ?? 0,
        } as RosterRow;
      });
    },
  });

  const roster = rosterQuery.data || [];
  const filteredRoster = roster.filter((r) =>
    r.name.toLowerCase().includes(rosterSearch.toLowerCase()),
  );
  const missingLogin = roster.filter((r) => r.readiness === 'login_required');
  const sharedConflicts = roster.filter((r) => r.readiness === 'shared_login_conflict');
  const selected = roster.find((r) => r.id === selectedId) || null;

  /* ---------------- selected ambassador's active assignments ---------------- */
  const assignedQuery = useQuery({
    queryKey: ['amb-assign-stores', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data, error } = await supabase
        .from('ambassador_assignments')
        .select('id, store_id, start_date, is_primary, store:store_master!store_id(id, store_name, address, city, state, zip, phone)')
        .eq('ambassador_id', selectedId)
        .eq('active', true)
        .not('store_id', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = (data || []).map((a: any) => a.store_id);
      let coords: any[] = [];
      if (ids.length) {
        const { data: c, error: cErr } = await supabase
          .from('stores').select('id, lat, lng').in('id', ids);
        if (cErr) throw cErr;
        coords = c || [];
      }
      const cMap = new Map(coords.map((c) => [c.id, c]));
      return (data || []).map((a: any) => ({
        assignment_id: a.id,
        store_id: a.store_id,
        name: a.store?.store_name || 'Unknown store',
        address: [a.store?.address, a.store?.city, a.store?.state, a.store?.zip]
          .filter(Boolean).join(', '),
        phone: a.store?.phone || null,
        start_date: a.start_date,
        lat: cMap.get(a.store_id)?.lat ?? null,
        lng: cMap.get(a.store_id)?.lng ?? null,
      }));
    },
    enabled: !!selectedId,
  });

  const assigned = assignedQuery.data || [];
  const assignedIds = assigned.map((a) => a.store_id);
  const needGeocode = assigned.filter((a) => a.lat == null || a.lng == null);

  /* ---------------- store picker ---------------- */
  const storeQuery = useQuery({
    queryKey: ['amb-assign-store-search', storeSearch],
    queryFn: async () => {
      let q = supabase
        .from('store_master')
        .select('id, store_name, address, city, state, zip')
        .is('deleted_at', null)
        .order('store_name')
        .limit(100);
      if (storeSearch.trim()) {
        const s = storeSearch.trim();
        q = q.or(`store_name.ilike.%${s}%,city.ilike.%${s}%,address.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: assignOpen,
  });

  const pickable = (storeQuery.data || []).filter((s: any) => !assignedIds.includes(s.id));

  /* ---------------- mutations ---------------- */
  const assignMutation = useMutation({
    mutationFn: async (storeIds: string[]) => {
      if (!selectedId) throw new Error('No ambassador selected');
      // Duplicate guard #1 — re-check current active assignments right before insert.
      const { data: current, error: cErr } = await supabase
        .from('ambassador_assignments')
        .select('store_id')
        .eq('ambassador_id', selectedId)
        .eq('active', true)
        .in('store_id', storeIds);
      if (cErr) throw cErr;
      const already = new Set((current || []).map((r: any) => r.store_id));
      const toInsert = storeIds.filter((id) => !already.has(id));
      if (!toInsert.length) throw new Error('All selected stores are already actively assigned');

      // Duplicate guard #2 — the DB partial unique index rejects any race.
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
      toast.success(`${inserted} store${inserted === 1 ? '' : 's'} assigned${skipped ? ` · ${skipped} skipped (already assigned)` : ''}`);
      setPickedStores([]);
      setAssignOpen(false);
      qc.invalidateQueries({ queryKey: ['amb-assign-stores', selectedId] });
      qc.invalidateQueries({ queryKey: ['amb-assign-roster'] });
    },
    onError: (e: any) => toast.error(e.message || 'Assignment failed'),
  });

  const unassignMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      // Soft unassign — the row stays as history.
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
      qc.invalidateQueries({ queryKey: ['amb-assign-stores', selectedId] });
      qc.invalidateQueries({ queryKey: ['amb-assign-roster'] });
    },
    onError: (e: any) => toast.error(e.message || 'Unassign failed'),
  });

  const routeMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No ambassador selected');
      if (selected.readiness === 'login_required' || !selected.user_id)
        throw new Error('Login Required — this ambassador has no login yet, so a route cannot be delivered to them');
      if (selected.readiness === 'shared_login_conflict')
        throw new Error('Shared Login Conflict — this login is used by more than one ambassador record. Give them their own login first');
      if (!routeStores.length) throw new Error('Pick at least one assigned store');

      const { data: route, error } = await supabase
        .from('routes')
        .insert({
          date: routeDate,
          territory: `${selected.name} — ${routeDate}`,
          name: `${selected.name} — ${routeDate}`,
          status: 'scheduled',
          type: 'ambassador',
          assigned_to: selected.user_id,
          created_by: user?.id ?? null,
          total_stops: routeStores.length,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: sErr } = await supabase.from('route_stops').insert(
        routeStores.map((store_id, i) => ({
          route_id: route.id,
          store_id,
          planned_order: i + 1,
          status: 'planned',
        })),
      );
      if (sErr) throw sErr;
      return route.id as string;
    },
    onSuccess: () => {
      toast.success('Route created and assigned');
      setRouteStores([]);
      qc.invalidateQueries({ queryKey: ['amb-assign-roster'] });
    },
    onError: (e: any) => toast.error(e.message || 'Route creation failed'),
  });

  const mapStores: MapStore[] = useMemo(
    () => assigned.map((a) => ({
      id: a.store_id, name: a.name, address: a.address, lat: a.lat, lng: a.lng, statusKey: 'assigned',
    })),
    [assigned],
  );

  /* ---------------- render ---------------- */
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ambassador Assignments & Routes</h1>
        <p className="text-sm text-muted-foreground">
          Existing roster, existing assignments, existing routes — organized in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Active ambassadors</p>
          <p className="text-2xl font-bold">{roster.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Ready</p>
          <p className="text-2xl font-bold text-emerald-500">{roster.filter((r) => r.readiness === 'ready').length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Login required</p>
          <p className="text-2xl font-bold text-amber-500">{missingLogin.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Shared login conflicts</p>
          <p className="text-2xl font-bold text-destructive">{sharedConflicts.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Active store assignments</p>
          <p className="text-2xl font-bold">{roster.reduce((a, r) => a + r.assignedCount, 0)}</p>
        </CardContent></Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roster */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Roster</CardTitle>
            <CardDescription>Select an ambassador to manage their stores</CardDescription>
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
              <ScrollArea className="h-[560px] pr-2">
                <div className="space-y-2">
                  {filteredRoster.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedId(r.id); setRouteStores([]); }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedId === r.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{r.name}</span>
                        <Badge variant="secondary">{r.assignedCount} stores</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className={`text-xs ${READINESS_CLASS[r.readiness]}`}>
                          {r.readiness !== 'ready' && <UserX className="h-3 w-3 mr-1" />}
                          {READINESS_LABEL[r.readiness]}
                          {r.readiness === 'shared_login_conflict' && ` (${r.sharedWith})`}
                        </Badge>
                        {r.latestRoute ? (
                          <span>route {r.latestRoute.status} · {r.latestRoute.date}</span>
                        ) : (
                          <span>no route</span>
                        )}
                        {r.state && <span>{r.state}</span>}
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

        {/* Detail */}
        <div className="lg:col-span-2 space-y-6">
          {!selected ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              Select an ambassador from the roster.
            </CardContent></Card>
          ) : (
            <>
              {!selected.user_id && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <span>
                    <strong>{selected.name}</strong> has no login account linked. Stores can still be
                    assigned, but a route cannot be delivered to them until a login exists.
                    No duplicate ambassador record was created.
                  </span>
                </div>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">{selected.name} — assigned stores</CardTitle>
                    <CardDescription>{assigned.length} active · history preserved on removal</CardDescription>
                  </div>
                  <Button onClick={() => setAssignOpen(true)}>
                    <Store className="h-4 w-4 mr-2" /> Assign stores
                  </Button>
                </CardHeader>
                <CardContent>
                  {assignedQuery.isLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : assigned.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No active store assignments.</p>
                  ) : (
                    <div className="space-y-2">
                      {assigned.map((a) => (
                        <div key={a.assignment_id} className="flex items-start gap-3 p-3 rounded-lg border">
                          <Checkbox
                            checked={routeStores.includes(a.store_id)}
                            onCheckedChange={(v) =>
                              setRouteStores((prev) =>
                                v ? [...prev, a.store_id] : prev.filter((id) => id !== a.store_id),
                              )
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{a.name}</span>
                              {(a.lat == null || a.lng == null) && (
                                <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                                  needs geocoding
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {a.address || 'No address on file'}
                            </p>
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => unassignMutation.mutate(a.assignment_id)}
                            disabled={unassignMutation.isPending}
                            aria-label={`Unassign ${a.name}`}
                          >
                            {unassignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RouteIcon className="h-4 w-4" /> Build a route
                  </CardTitle>
                  <CardDescription>
                    Uses the existing routes / route stops system. Tick stores above, pick a date, create.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-xs">Route date</Label>
                    <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} />
                  </div>
                  <Badge variant="secondary">{routeStores.length} stop{routeStores.length === 1 ? '' : 's'} selected</Badge>
                  <Button
                    onClick={() => routeMutation.mutate()}
                    disabled={routeMutation.isPending || !routeStores.length || !selected.user_id}
                  >
                    {routeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create route
                  </Button>
                  {!selected.user_id && (
                    <span className="text-xs text-amber-500">Login required before a route can be assigned.</span>
                  )}
                </CardContent>
              </Card>

              <AmbassadorStoreMap
                stores={mapStores}
                title={`${selected.name} — store map`}
                height={380}
              />
              {needGeocode.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {needGeocode.length} assigned store{needGeocode.length === 1 ? '' : 's'} still need coordinates before they can appear on the map.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign stores to {selected?.name}</DialogTitle>
            <DialogDescription>
              Canonical store records only. Stores already actively assigned to this ambassador are hidden.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by store name, address or city"
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[360px] pr-2">
            {storeQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="space-y-2">
                {pickable.map((s: any) => (
                  <label key={s.id} className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={pickedStores.includes(s.id)}
                      onCheckedChange={(v) =>
                        setPickedStores((prev) => (v ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                      }
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.store_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[s.address, s.city, s.state, s.zip].filter(Boolean).join(', ') || 'No address on file'}
                      </p>
                    </div>
                  </label>
                ))}
                {!pickable.length && (
                  <p className="text-sm text-muted-foreground py-6 text-center">No matching unassigned stores.</p>
                )}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={() => assignMutation.mutate(pickedStores)}
              disabled={!pickedStores.length || assignMutation.isPending}
            >
              {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign {pickedStores.length || ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
