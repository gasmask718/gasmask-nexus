/**
 * Per-neighborhood store roster — relationship health at a glance.
 * Reused on NeighborhoodDetailPage (and any future neighborhood-scoped view).
 *
 * Pulls from:
 *  - stores (filter by neighborhood, get name/address)
 *  - store_master (relationship_status, owner, last_order_at)
 *  - v_store_tube_summary (lifetime tubes delivered)
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpDown, Search } from 'lucide-react';
import { format } from 'date-fns';
import {
  RELATIONSHIP_STATUS_COLORS,
  RELATIONSHIP_STATUS_SHORT,
  STORE_RELATIONSHIP_STATUSES,
  type StoreRelationshipStatus,
} from '@/config/storeRelationshipStatus';

type SortKey = 'name' | 'status' | 'last_order' | 'tubes';
type SortDir = 'asc' | 'desc';

interface Props {
  neighborhood: string;
}

interface Row {
  id: string;
  name: string;
  address: string | null;
  owner_name: string | null;
  relationship_status: StoreRelationshipStatus | null;
  last_order_at: string | null;
  tubes: number;
}

export function NeighborhoodStoreBreakdown({ neighborhood }: Props) {
  const [statusFilter, setStatusFilter] = useState<'all' | StoreRelationshipStatus>('all');
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('tubes');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['neighborhood-store-breakdown', neighborhood],
    enabled: !!neighborhood,
    staleTime: 60_000,
    queryFn: async () => {
      // 1) Stores in this neighborhood
      const { data: storesRows, error: storesErr } = await supabase
        .from('stores')
        .select('id, name, address_street, address_city, neighborhood')
        .eq('neighborhood', neighborhood)
        .is('deleted_at', null);
      if (storesErr) throw storesErr;
      const ids = (storesRows || []).map((s: any) => s.id);
      if (ids.length === 0) return [];

      // 2) store_master enrichment
      const { data: masterRows } = await supabase
        .from('store_master')
        .select('id, owner_name, relationship_status, last_order_at, address, store_name')
        .in('id', ids);
      const masterMap = new Map<string, any>();
      (masterRows || []).forEach((m: any) => masterMap.set(m.id, m));

      // 3) Tube volume from summary view
      const { data: tubeRows } = await supabase
        .from('v_store_tube_summary' as any)
        .select('store_id, lifetime_tubes_delivered')
        .in('store_id', ids);
      const tubeMap = new Map<string, number>();
      (tubeRows || []).forEach((t: any) =>
        tubeMap.set(t.store_id, Number(t.lifetime_tubes_delivered || 0)),
      );

      return (storesRows || []).map((s: any): Row => {
        const m = masterMap.get(s.id) ?? {};
        return {
          id: s.id,
          name: m.store_name || s.name || 'Unnamed',
          address:
            m.address ||
            [s.address_street, s.address_city].filter(Boolean).join(', ') ||
            null,
          owner_name: m.owner_name ?? null,
          relationship_status: (m.relationship_status as StoreRelationshipStatus) ?? null,
          last_order_at: m.last_order_at ?? null,
          tubes: tubeMap.get(s.id) ?? 0,
        };
      });
    },
  });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const s of STORE_RELATIONSHIP_STATUSES) counts[s] = 0;
    counts['__none__'] = 0;
    rows.forEach((r) => {
      const k = r.relationship_status ?? '__none__';
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (statusFilter !== 'all' && r.relationship_status !== statusFilter) return false;
      if (!term) return true;
      return [r.name, r.address, r.owner_name]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(term));
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    out = [...out].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'status':
          return (a.relationship_status ?? '').localeCompare(b.relationship_status ?? '') * dir;
        case 'last_order': {
          const ax = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
          const bx = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
          return (ax - bx) * dir;
        }
        case 'tubes':
          return (a.tubes - b.tubes) * dir;
      }
    });
    return out;
  }, [rows, statusFilter, q, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(k);
      setSortDir(k === 'name' || k === 'status' ? 'asc' : 'desc');
    }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">
              Stores in {neighborhood}{' '}
              <Badge variant="secondary">{rows.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Every store in this neighborhood — relationship health, recency &amp; tube volume.
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Search store, owner, address…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className="h-7 text-xs"
          >
            All <span className="ml-1 opacity-70">{statusCounts.all}</span>
          </Button>
          {STORE_RELATIONSHIP_STATUSES.map((s) => {
            const n = statusCounts[s] ?? 0;
            if (n === 0) return null;
            return (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                onClick={() => setStatusFilter(s)}
                className="h-7 text-xs"
              >
                {RELATIONSHIP_STATUS_SHORT[s]} <span className="ml-1 opacity-70">{n}</span>
              </Button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortBtn k="name" label="Store" /></TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead><SortBtn k="status" label="Status" /></TableHead>
                <TableHead><SortBtn k="last_order" label="Last Order" /></TableHead>
                <TableHead className="text-right"><SortBtn k="tubes" label="Tubes" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No stores match.</TableCell></TableRow>
              ) : (
                visibleRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link to={`/stores/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.address ?? '—'}</TableCell>
                    <TableCell className="text-sm">{r.owner_name ?? '—'}</TableCell>
                    <TableCell>
                      {r.relationship_status ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${RELATIONSHIP_STATUS_COLORS[r.relationship_status]}`}
                        >
                          {RELATIONSHIP_STATUS_SHORT[r.relationship_status]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.last_order_at ? format(new Date(r.last_order_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{r.tubes.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default NeighborhoodStoreBreakdown;
