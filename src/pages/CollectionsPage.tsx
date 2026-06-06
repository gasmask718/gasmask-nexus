import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, DollarSign, Flag, Loader2, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStorePaymentStatusMap } from '@/hooks/useStorePaymentStatus';
import { FlagCollectionButton } from '@/components/payments/FlagCollectionButton';
import { INVOICE_BADGE_CLASS } from '@/lib/invoiceRowStyle';

interface FlaggedTrigger {
  id: string;
  store_id: string | null;
  store_name: string;
  urgency: string | null;
  priority_score: number | null;
  ai_recommendation: string | null;
  status: string | null;
}

/**
 * Collections — single roll-up of every store with money owed, plus everything
 * already flagged for in-person collection (gasmask_visit_triggers.trigger_type
 * = 'collect_payment'). Lets ops trigger or clear collection flags here so the
 * route engine picks them up like any other visit.
 */
export default function CollectionsPage() {
  const { data: owedMap, isLoading: owedLoading } = useStorePaymentStatusMap();

  const { data: flagged = [], isLoading: flaggedLoading } = useQuery({
    queryKey: ['collections-pool'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gasmask_visit_triggers')
        .select('id, store_id, store_name, urgency, priority_score, ai_recommendation, status')
        .eq('trigger_type', 'collect_payment')
        .in('status', ['pending', 'in_progress'])
        .order('priority_score', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FlaggedTrigger[];
    },
    refetchInterval: 60_000,
  });

  // Resolve store names for owed map
  const storeIds = useMemo(() => Array.from(owedMap?.keys() ?? []), [owedMap]);
  const { data: stores = [] } = useQuery({
    queryKey: ['collections-store-names', storeIds],
    queryFn: async () => {
      if (!storeIds.length) return [] as { id: string; name: string; address_city: string | null }[];
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address_city')
        .in('id', storeIds);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; address_city: string | null }[];
    },
    enabled: storeIds.length > 0,
  });

  const nameById = useMemo(() => {
    const m = new Map<string, { name: string; city: string | null }>();
    for (const s of stores) m.set(s.id, { name: s.name, city: s.address_city ?? null });
    return m;
  }, [stores]);

  const rows = useMemo(() => {
    const out: {
      storeId: string;
      name: string;
      city: string | null;
      owed: number;
      unpaidCount: number;
      oldestDays: number | null;
      level: 'red' | 'amber' | 'paid';
      flagged: FlaggedTrigger | undefined;
    }[] = [];
    const map = owedMap ?? new Map();
    for (const [storeId, s] of map.entries()) {
      if (s.owed <= 0) continue;
      const meta = nameById.get(storeId);
      out.push({
        storeId,
        name: meta?.name ?? 'Unknown store',
        city: meta?.city ?? null,
        owed: s.owed,
        unpaidCount: s.unpaidCount,
        oldestDays: s.oldestUnpaidDays,
        level: s.level,
        flagged: flagged.find((f) => f.store_id === storeId),
      });
    }
    return out.sort((a, b) => b.owed - a.owed);
  }, [owedMap, nameById, flagged]);

  // Orphan flags (flagged in pool but no matching store_id in owed map)
  const orphans = useMemo(
    () => flagged.filter((f) => !f.store_id || !owedMap?.get(f.store_id)?.owed),
    [flagged, owedMap],
  );

  const totalOwed = rows.reduce((s, r) => s + r.owed, 0);
  const flaggedCount = rows.filter((r) => r.flagged).length;
  const loading = owedLoading || flaggedLoading;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold">Collections</h1>
            <p className="text-muted-foreground">
              Stores owing money — flag for in-person collection and the route engine routes a visit.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Total Outstanding</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                {totalOwed.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Stores Owing</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{rows.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Flagged for Collection</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{flaggedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Red (≥$200 or 14d+)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {rows.filter((r) => r.level === 'red').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Owed Stores</CardTitle>
            <CardDescription>
              Ranked by amount owed. Flag a store to push a collect-payment visit into the route pool.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : rows.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No outstanding balances 🎉</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Owed</TableHead>
                    <TableHead>Unpaid</TableHead>
                    <TableHead>Oldest</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const rowCls =
                      r.level === 'red'
                        ? 'bg-red-500/10 hover:bg-red-500/15'
                        : 'bg-amber-500/5 hover:bg-amber-500/10';
                    return (
                      <TableRow key={r.storeId} className={rowCls}>
                        <TableCell>
                          <Link to={`/stores/${r.storeId}`} className="font-medium hover:underline flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {r.name}
                          </Link>
                          {r.city && <div className="text-xs text-muted-foreground">{r.city}</div>}
                        </TableCell>
                        <TableCell className="font-bold">${r.owed.toFixed(2)}</TableCell>
                        <TableCell>{r.unpaidCount}</TableCell>
                        <TableCell>{r.oldestDays != null ? `${r.oldestDays}d` : '—'}</TableCell>
                        <TableCell>
                          {r.flagged ? (
                            <Badge variant="outline" className={INVOICE_BADGE_CLASS.unpaid + ' gap-1'}>
                              <Flag className="h-3 w-3" /> {r.flagged.urgency ?? 'normal'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={r.level === 'red' ? INVOICE_BADGE_CLASS.overdue : INVOICE_BADGE_CLASS.unpaid}>
                              {r.level === 'red' ? 'overdue' : 'unpaid'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <FlagCollectionButton
                            storeId={r.storeId}
                            storeName={r.name}
                            owedAmount={r.owed}
                            oldestDays={r.oldestDays}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {orphans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Flagged without matching open balance ({orphans.length})</CardTitle>
              <CardDescription>
                Pool entries whose store no longer has open invoices — clear once collected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {orphans.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <span>
                      {f.store_name} — <span className="text-muted-foreground">{f.urgency ?? 'normal'}</span>
                    </span>
                    {f.store_id && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/stores/${f.store_id}`}>Open</Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
