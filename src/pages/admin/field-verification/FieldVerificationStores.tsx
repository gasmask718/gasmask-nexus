import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Store, AlertTriangle } from 'lucide-react';
import { useCrewDrops, useCrewProfiles, crewNameMap } from '@/hooks/useFieldVerification';
import {
  useAmbassadorInventory, useProfileNames, stalenessLabel, isStale, daysSince,
  STALE_DAYS, RECENT_DAYS,
} from '@/hooks/useAmbassadorInventory';

const GAP_LIMIT = 100;

export default function FieldVerificationStores() {
  const { data: drops, isLoading, error } = useCrewDrops();
  const { data: profiles } = useCrewProfiles();
  const names = useMemo(() => crewNameMap(profiles), [profiles]);

  const {
    data: inventory, isLoading: invLoading, error: invError,
  } = useAmbassadorInventory();

  const visits = useMemo(() => (drops ?? []).filter((d) => d.drop_type === 'store_visit'), [drops]);
  const visitedStoreIds = useMemo(
    () => new Set(visits.map((v) => v.store_id).filter(Boolean) as string[]),
    [visits],
  );

  // Stores with a real human ambassador check-in recently but no crew visit.
  const gapEntries = useMemo(() => {
    if (!inventory) return [];
    return Array.from(inventory.values())
      .filter((c) => {
        if (visitedStoreIds.has(c.store_id)) return false;
        const d = daysSince(c.last_human_update);
        return d !== null && d <= RECENT_DAYS;
      })
      .sort((a, b) => (b.last_human_update ?? '').localeCompare(a.last_human_update ?? ''));
  }, [inventory, visitedStoreIds]);


  const gapShown = useMemo(() => gapEntries.slice(0, GAP_LIMIT), [gapEntries]);

  const storeIdsToName = useMemo(
    () => Array.from(new Set([...visitedStoreIds, ...gapShown.map((g) => g.store_id)])),
    [visitedStoreIds, gapShown],
  );

  const { data: stores } = useQuery({
    queryKey: ['fv-visit-stores', storeIdsToName],
    enabled: storeIdsToName.length > 0,
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('store_master')
        .select('id, store_name, address, city, state')
        .in('id', storeIdsToName);
      if (e) throw e;
      return data ?? [];
    },
  });

  const storeById = useMemo(() => {
    const m = new Map<string, { store_name: string | null; address: string | null; city: string | null; state: string | null }>();
    (stores ?? []).forEach((s: any) => m.set(s.id, s));
    return m;
  }, [stores]);

  const updaterIds = useMemo(() => {
    const ids: string[] = [];
    (inventory ? Array.from(inventory.values()) : []).forEach((c) => {
      if (c.last_updated_by) ids.push(c.last_updated_by);
    });
    return ids;
  }, [inventory]);
  const { data: updaterNames } = useProfileNames(updaterIds);
  const updaterLabel = (id: string | null) =>
    (id ? updaterNames?.get(id) ?? `User ${id.slice(0, 8)}…` : 'Not recorded');

  const rows = useMemo(() => {
    const groups = new Map<string, typeof visits>();
    for (const v of visits) {
      const key = v.store_id ?? `name:${(v.store_name ?? 'Unknown store').toLowerCase()}`;
      const list = groups.get(key) ?? [];
      list.push(v);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).map(([key, list]) => {
      const storeId = list[0].store_id;
      const rec = storeId ? storeById.get(storeId) : undefined;
      const verified = list
        .filter((v) => v.status === 'verified')
        .sort((a, b) => new Date(b.verified_at ?? 0).getTime() - new Date(a.verified_at ?? 0).getTime());
      const last = verified[0];
      const claim = storeId ? inventory?.get(storeId) : undefined;
      const crewDays = daysSince(last?.verified_at ?? null);
      const ambStale = claim ? isStale(claim.last_updated_at) : false;
      // Honest timing mismatch: only when both sides have data.
      const mismatch =
        claim && crewDays !== null && crewDays <= STALE_DAYS && ambStale
          ? 'Crew verified recently, ambassador record stale'
          : claim && crewDays !== null && crewDays > STALE_DAYS && !ambStale
            ? 'Ambassador updating, crew has not verified recently'
            : null;
      return {
        key,
        name: rec?.store_name || list[0].store_name || 'Unknown store',
        location: rec ? [rec.address, rec.city, rec.state].filter(Boolean).join(', ') : '',
        total: list.length,
        verifiedCount: verified.length,
        lastVerified: last?.verified_at ?? null,
        lastVerifier: last?.verified_by ? names.get(last.verified_by) ?? 'Management' : null,
        lastCrew: last ? names.get(last.crew_id) ?? 'Unknown crew' : null,
        claim,
        ambStale,
        mismatch,
      };
    }).sort((a, b) => new Date(b.lastVerified ?? 0).getTime() - new Date(a.lastVerified ?? 0).getTime());
  }, [visits, storeById, names, inventory]);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6 text-primary" /> Per-Store Verification</h1>
        <p className="text-sm text-muted-foreground">
          Crew store visits next to the ambassador inventory record for the same store.
          Stale means no ambassador update in over {STALE_DAYS} days.
        </p>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>}
      {error && <Card><CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent></Card>}
      {!isLoading && !error && rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No store visits recorded yet.</CardContent></Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Verified</TableHead>
                  <TableHead>Last verified</TableHead>
                  <TableHead>Visited by</TableHead>
                  <TableHead>Ambassador stock</TableHead>
                  <TableHead>Ambassador update</TableHead>
                  <TableHead>Timing gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.location || '—'}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.verifiedCount}</TableCell>
                    <TableCell>
                      {r.lastVerified
                        ? new Date(r.lastVerified).toLocaleDateString()
                        : <Badge variant="secondary">Not yet verified</Badge>}
                    </TableCell>
                    <TableCell>{r.lastCrew ?? '—'}</TableCell>
                    <TableCell>
                      {r.claim ? (
                        <div className="flex items-center gap-2">
                          <span>{r.claim.tubes_left} tubes</span>
                          {r.claim.needs_order && <Badge variant="outline">Needs order</Badge>}
                        </div>
                      ) : <span className="text-muted-foreground">No record</span>}
                    </TableCell>
                    <TableCell>
                      {r.claim ? (
                        <div className="space-y-0.5">
                          <div className={r.ambStale ? 'text-destructive' : ''}>
                            {stalenessLabel(r.claim.last_updated_at)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            by {updaterLabel(r.claim.last_updated_by)}
                          </div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {r.mismatch
                        ? <Badge variant="outline" className="border-destructive/50 text-destructive">{r.mismatch}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Coverage gaps — ambassador active, crew never visited
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {invError && <div className="p-4 text-sm text-destructive">{(invError as Error).message}</div>}
          {!invLoading && !invError && gapEntries.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No gaps — every store with a recent ambassador update has a crew visit.
            </div>
          )}
          {gapShown.length > 0 && (
            <>
              <div className="px-4 pb-2 text-sm text-muted-foreground">
                {gapEntries.length} stores updated by an ambassador in the last {RECENT_DAYS} days with no crew store visit
                {gapEntries.length > GAP_LIMIT && ` — showing the ${GAP_LIMIT} most recent`}.
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>Needs order</TableHead>
                      <TableHead>Ambassador update</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gapShown.map((g) => {
                      const rec = storeById.get(g.store_id);
                      return (
                        <TableRow key={g.store_id}>
                          <TableCell className="font-medium">{rec?.store_name || 'Unknown store'}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {rec ? [rec.address, rec.city, rec.state].filter(Boolean).join(', ') || '—' : '—'}
                          </TableCell>
                          <TableCell className="text-right">{g.tubes_left}</TableCell>
                          <TableCell>{g.needs_order ? <Badge variant="outline">Yes</Badge> : '—'}</TableCell>
                          <TableCell className={isStale(g.last_updated_at) ? 'text-destructive' : ''}>
                            {stalenessLabel(g.last_updated_at)}
                          </TableCell>
                          <TableCell>{updaterLabel(g.last_updated_by)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Ambassador figures are read-only from the live inventory record, summed across all brands tracked for
        that store. Timing gaps are shown for judgment only — they do not prove a stock count is wrong.
      </p>
    </div>
  );
}
