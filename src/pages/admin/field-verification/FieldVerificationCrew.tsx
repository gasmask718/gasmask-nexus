import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, AlertTriangle, ArrowUpDown } from 'lucide-react';
import {
  useCrewDrops, useCrewProfiles, useCrewZones, computeGpsDriftCrewIds,
} from '@/hooks/useFieldVerification';

type SortKey = 'name' | 'total' | 'today' | 'week' | 'verified' | 'pending' | 'earnings';

export default function FieldVerificationCrew() {
  const { data: drops, isLoading: dropsLoading, error: dropsError } = useCrewDrops();
  const { data: profiles, isLoading: profLoading, error: profError } = useCrewProfiles();
  const { data: zones } = useCrewZones();

  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [asc, setAsc] = useState(false);

  const drift = useMemo(() => computeGpsDriftCrewIds(drops ?? []), [drops]);
  const zoneName = useMemo(() => {
    const m = new Map<string, string>();
    (zones ?? []).forEach((z) => m.set(z.id, z.name || 'Unnamed zone'));
    return m;
  }, [zones]);

  const rows = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - 7 * 86400000;
    const ts = (s: string | null) => (s ? new Date(s).getTime() : 0);

    return (profiles ?? []).map((p) => {
      const mine = (drops ?? []).filter((d) => d.crew_id === p.user_id);
      return {
        id: p.id,
        name: p.full_name || 'Unnamed crew',
        zone: p.zone_id ? zoneName.get(p.zone_id) ?? '—' : '—',
        status: p.status ?? 'unknown',
        total: mine.length,
        today: mine.filter((d) => ts(d.server_timestamp) >= startOfDay).length,
        week: mine.filter((d) => ts(d.server_timestamp) >= weekAgo).length,
        verified: mine.filter((d) => d.status === 'verified').length,
        pending: mine.filter((d) => d.status === 'pending').length,
        earnings: mine.filter((d) => d.status === 'verified').reduce((s, d) => s + Number(d.earnings ?? 0), 0),
        drift: drift.has(p.user_id),
      };
    });
  }, [profiles, drops, zoneName, drift]);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return list;
  }, [rows, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else { setSortKey(k); setAsc(k === 'name'); }
  };

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <TableHead className={right ? 'text-right' : ''}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggle(k)}>
        {label} <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  );

  const loading = dropsLoading || profLoading;
  const error = dropsError || profError;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Per-Crew Performance</h1>
        <p className="text-sm text-muted-foreground">Sort any column to spot the strongest and weakest crew members.</p>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>}
      {error && <Card><CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent></Card>}
      {!loading && !error && sorted.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No crew members yet.</CardContent></Card>
      )}

      {!loading && !error && sorted.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <Th k="name" label="Crew member" />
                  <TableHead>Zone</TableHead>
                  <TableHead>Status</TableHead>
                  <Th k="total" label="Total" right />
                  <Th k="today" label="Today" right />
                  <Th k="week" label="This week" right />
                  <Th k="verified" label="Verified" right />
                  <Th k="pending" label="Pending" right />
                  <Th k="earnings" label="Earnings" right />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.name}
                        {r.drift && (
                          <Badge variant="outline" className="border-amber-500 text-amber-500 gap-1">
                            <AlertTriangle className="h-3 w-3" /> GPS drift
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{r.zone}</TableCell>
                    <TableCell><Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.today}</TableCell>
                    <TableCell className="text-right">{r.week}</TableCell>
                    <TableCell className="text-right">{r.verified}</TableCell>
                    <TableCell className="text-right">{r.pending}</TableCell>
                    <TableCell className="text-right">${r.earnings.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        “GPS drift” means a crew member’s last 20 drops all fall within ~50m — worth a look, nothing is auto-rejected.
      </p>
    </div>
  );
}
