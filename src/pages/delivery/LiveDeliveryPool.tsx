import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Package,
  Radio,
  Search,
  Send,
  Truck,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import { formatDistanceToNow } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE DELIVERY POOL — Floor 4
//
// Truth source: marketplace_orders + marketplace_order_items.
// New owner-placed orders land here (fulfillment_status = 'pending'), dispatch
// drops them into the existing RouteAssignmentDialog (which writes a route +
// route_stop with order_ids attached). Once a route is assigned, status flips
// to 'processing' and the row moves to the Dispatched tab.
// ═══════════════════════════════════════════════════════════════════════════════

type PoolStatus = 'new' | 'dispatched' | 'delivered';

interface PoolRow {
  id: string;
  created_at: string;
  fulfillment_status: string;
  payment_status: string;
  total: number;
  notes: string | null;
  ordering_store_id: string | null;
  user_id: string;
  shipping_address: any;
  store_name: string | null;
  item_count: number;
  item_summary: string;
}

function bucket(row: PoolRow): PoolStatus {
  const f = row.fulfillment_status;
  if (f === 'pending') return 'new';
  if (f === 'delivered') return 'delivered';
  return 'dispatched';
}

function usePool() {
  return useQuery({
    queryKey: ['live-delivery-pool'],
    refetchInterval: 15_000,
    queryFn: async (): Promise<PoolRow[]> => {
      const { data: orders, error } = await supabase
        .from('marketplace_orders')
        .select(
          'id, created_at, fulfillment_status, payment_status, total, notes, ordering_store_id, user_id, shipping_address',
        )
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const ids = (orders ?? []).map((o) => o.id);
      if (ids.length === 0) return [];

      const [{ data: items }, { data: stores }] = await Promise.all([
        supabase
          .from('marketplace_order_items')
          .select('order_id, product_name, qty')
          .in('order_id', ids),
        supabase
          .from('store_master')
          .select('id, store_name')
          .in(
            'id',
            (orders ?? [])
              .map((o) => o.ordering_store_id)
              .filter((x): x is string => !!x),
          ),
      ]);

      const itemsByOrder = new Map<string, { product_name: string; qty: number }[]>();
      for (const it of (items as any[]) ?? []) {
        const arr = itemsByOrder.get(it.order_id) ?? [];
        arr.push({ product_name: it.product_name, qty: it.qty });
        itemsByOrder.set(it.order_id, arr);
      }
      const storeNameById = new Map<string, string>();
      for (const s of (stores as any[]) ?? []) storeNameById.set(s.id, s.store_name);

      return (orders ?? []).map((o: any) => {
        const its = itemsByOrder.get(o.id) ?? [];
        return {
          ...o,
          store_name:
            storeNameById.get(o.ordering_store_id) ||
            o.shipping_address?.fullName ||
            'Unknown store',
          item_count: its.reduce((s, x) => s + Number(x.qty || 0), 0),
          item_summary: its
            .slice(0, 3)
            .map((x) => `${x.qty}× ${x.product_name}`)
            .join(', ') + (its.length > 3 ? `, +${its.length - 3} more` : ''),
        } as PoolRow;
      });
    },
  });
}

function StatusBadge({ row }: { row: PoolRow }) {
  const b = bucket(row);
  if (b === 'new')
    return (
      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
        <Radio className="h-3 w-3 mr-1 animate-pulse" /> NEW
      </Badge>
    );
  if (b === 'dispatched')
    return (
      <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">
        <Truck className="h-3 w-3 mr-1" /> Dispatched
      </Badge>
    );
  return (
    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
      <CheckCircle2 className="h-3 w-3 mr-1" /> Delivered
    </Badge>
  );
}

export default function LiveDeliveryPool() {
  const { data: rows = [], isLoading, refetch, isFetching } = usePool();
  const qc = useQueryClient();
  const [tab, setTab] = useState<PoolStatus | 'all'>('new');
  const [q, setQ] = useState('');
  const [dispatchRow, setDispatchRow] = useState<PoolRow | null>(null);

  const counts = useMemo(
    () => ({
      new: rows.filter((r) => bucket(r) === 'new').length,
      dispatched: rows.filter((r) => bucket(r) === 'dispatched').length,
      delivered: rows.filter((r) => bucket(r) === 'delivered').length,
      all: rows.length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return rows.filter((r) => {
      if (tab !== 'all' && bucket(r) !== tab) return false;
      if (!ql) return true;
      return (
        (r.store_name ?? '').toLowerCase().includes(ql) ||
        r.item_summary.toLowerCase().includes(ql) ||
        r.id.toLowerCase().includes(ql)
      );
    });
  }, [rows, tab, q]);

  const markDelivered = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketplace_orders')
        .update({ fulfillment_status: 'delivered' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marked delivered');
      qc.invalidateQueries({ queryKey: ['live-delivery-pool'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });

  const markDispatched = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketplace_orders')
        .update({ fulfillment_status: 'processing' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-delivery-pool'] });
    },
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-amber-500" />
            Live Delivery Pool
          </h1>
          <p className="text-sm text-muted-foreground">
            Owner-placed orders land here in real time. Drop them into a route to dispatch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/delivery/orders">
            <Button variant="outline" size="sm">
              Orders & Deliveries
              <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="new">
                  New
                  <Badge variant="secondary" className="ml-2">
                    {counts.new}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="dispatched">
                  Dispatched
                  <Badge variant="secondary" className="ml-2">
                    {counts.dispatched}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="delivered">
                  Delivered
                  <Badge variant="secondary" className="ml-2">
                    {counts.delivered}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="all">
                  All
                  <Badge variant="secondary" className="ml-2">
                    {counts.all}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search store, item, ID…"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading pool…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No orders in this bucket</p>
              <p className="text-sm">
                When a store owner places an order, it lands here in real time.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((row) => {
                const b = bucket(row);
                const ageLabel = formatDistanceToNow(new Date(row.created_at), {
                  addSuffix: true,
                });
                return (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-start gap-3 p-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge row={row} />
                        {row.ordering_store_id && (
                          <Link
                            to={`/stores/${row.ordering_store_id}`}
                            className="font-semibold hover:underline"
                          >
                            {row.store_name}
                          </Link>
                        )}
                        {!row.ordering_store_id && (
                          <span className="font-semibold">{row.store_name}</span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          ${Number(row.total ?? 0).toFixed(2)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {row.item_count} units
                        </Badge>
                        <span className="text-xs text-muted-foreground">{ageLabel}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {row.item_summary || 'No items'}
                      </p>
                      {row.notes && (
                        <p className="text-xs italic text-muted-foreground mt-1">
                          “{row.notes}”
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {b === 'new' && (
                        <Button
                          size="sm"
                          onClick={() => setDispatchRow(row)}
                          disabled={!row.ordering_store_id}
                          title={
                            row.ordering_store_id
                              ? 'Assign to a driver/biker/ambassador route'
                              : 'Order has no linked store — assign manually in Orders & Deliveries'
                          }
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Dispatch
                        </Button>
                      )}
                      {b === 'dispatched' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markDelivered.mutate(row.id)}
                          disabled={markDelivered.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Mark delivered
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {dispatchRow?.ordering_store_id && (
        <RouteAssignmentDialog
          open={!!dispatchRow}
          onOpenChange={(o) => {
            if (!o) setDispatchRow(null);
          }}
          assigneeId=""
          assigneeName=""
          assigneeType="driver"
          bulkMode
          preselectedStores={[dispatchRow.ordering_store_id]}
          brandStopContext={[
            {
              store_id: dispatchRow.ordering_store_id,
              order_ids: [dispatchRow.id],
            },
          ]}
          onAssigned={() => {
            markDispatched.mutate(dispatchRow.id);
            toast.success(`Order routed — ${dispatchRow.store_name} is on a run`);
            setDispatchRow(null);
          }}
        />
      )}
    </div>
  );
}
