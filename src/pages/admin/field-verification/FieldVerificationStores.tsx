import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Store } from 'lucide-react';
import { useCrewDrops, useCrewProfiles, crewNameMap } from '@/hooks/useFieldVerification';

export default function FieldVerificationStores() {
  const { data: drops, isLoading, error } = useCrewDrops();
  const { data: profiles } = useCrewProfiles();
  const names = useMemo(() => crewNameMap(profiles), [profiles]);

  const visits = useMemo(() => (drops ?? []).filter((d) => d.drop_type === 'store_visit'), [drops]);
  const storeIds = useMemo(
    () => Array.from(new Set(visits.map((v) => v.store_id).filter(Boolean))) as string[],
    [visits],
  );

  const { data: stores } = useQuery({
    queryKey: ['fv-visit-stores', storeIds],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('store_master')
        .select('id, store_name, address, city, state')
        .in('id', storeIds);
      if (e) throw e;
      return data ?? [];
    },
  });

  const storeById = useMemo(() => {
    const m = new Map<string, { store_name: string | null; address: string | null; city: string | null; state: string | null }>();
    (stores ?? []).forEach((s: any) => m.set(s.id, s));
    return m;
  }, [stores]);

  const rows = useMemo(() => {
    const groups = new Map<string, typeof visits>();
    for (const v of visits) {
      const key = v.store_id ?? `name:${(v.store_name ?? 'Unknown store').toLowerCase()}`;
      const list = groups.get(key) ?? [];
      list.push(v);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).map(([key, list]) => {
      const rec = list[0].store_id ? storeById.get(list[0].store_id) : undefined;
      const verified = list
        .filter((v) => v.status === 'verified')
        .sort((a, b) => new Date(b.verified_at ?? 0).getTime() - new Date(a.verified_at ?? 0).getTime());
      const last = verified[0];
      return {
        key,
        name: rec?.store_name || list[0].store_name || 'Unknown store',
        location: rec ? [rec.address, rec.city, rec.state].filter(Boolean).join(', ') : '',
        total: list.length,
        verifiedCount: verified.length,
        lastVerified: last?.verified_at ?? null,
        lastVerifier: last?.verified_by ? names.get(last.verified_by) ?? 'Management' : null,
        lastCrew: last ? names.get(last.crew_id) ?? 'Unknown crew' : null,
      };
    }).sort((a, b) => new Date(b.lastVerified ?? 0).getTime() - new Date(a.lastVerified ?? 0).getTime());
  }, [visits, storeById, names]);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6 text-primary" /> Per-Store Verification</h1>
        <p className="text-sm text-muted-foreground">Store visits logged by the field crew, newest verification first.</p>
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
                  <TableHead>Verified by</TableHead>
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
                    <TableCell>{r.lastVerifier ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        This is the crew-side record only — there is no separate ambassador stocking status to compare against.
      </p>
    </div>
  );
}
