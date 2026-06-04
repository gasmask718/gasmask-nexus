/**
 * Dynasty Direct — Orders Management Datatable
 *
 * Single filterable table joining marketplace_orders, marketplace_order_items,
 * marketplace_fulfillments, shipping_labels, products_all, wholesalers.
 * Pattern mirrors GasMask Orders & Deliveries — unpaid rows BOLD.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { format } from 'date-fns';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { InviteButton } from '@/components/invites/InviteButton';
import { DDAlertBar } from '@/components/dynasty-direct/DDAlertBar';
import { DDDrillMenu, ddDrill } from '@/components/dynasty-direct/DDDrillMenu';

type OrderRow = {
  id: string;
  created_at: string;
  total: number;
  payment_status: string | null;
  fulfillment_status: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  order_type: string | null;
  shipping_address: any;
  notes: string | null;
  items: Array<{
    id: string;
    qty: number;
    price_each: number;
    product_id: string;
    product_name?: string;
    wholesaler_id: string | null;
    wholesaler_name?: string;
  }>;
  fulfillments: Array<{
    id: string;
    wholesaler_id: string;
    wholesaler_name?: string;
    status: string;
    carrier: string | null;
    tracking_number: string | null;
    shipping_label_url: string | null;
    created_at: string;
  }>;
  labels: Array<{
    id: string;
    carrier: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    label_url: string | null;
    status: string | null;
    label_cost: number | null;
    created_at: string;
  }>;
};

function carrierTrackUrl(carrier: string | null, tracking: string | null): string | null {
  if (!tracking) return null;
  const c = (carrier || '').toLowerCase();
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${tracking}`;
  if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  if (c.includes('dhl')) return `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
  return null;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return `$${Number(n).toFixed(2)}`;
}

export default function DynastyDirectOrders() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [selected, setSelected] = useState<OrderRow | null>(null);

  async function load() {
    setLoading(true);
    // 1. base orders
    const { data: orders } = await supabase
      .from('marketplace_orders')
      .select('id, created_at, total, payment_status, fulfillment_status, customer_email, customer_phone, order_type, shipping_address, notes')
      .order('created_at', { ascending: false })
      .limit(500);

    const ids = (orders || []).map((o: any) => o.id);
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const [{ data: items }, { data: fulfillments }, { data: labels }] = await Promise.all([
      supabase
        .from('marketplace_order_items')
        .select('id, order_id, qty, price_each, product_id, wholesaler_id')
        .in('order_id', ids),
      supabase
        .from('marketplace_fulfillments')
        .select('id, order_id, wholesaler_id, status, carrier, tracking_number, shipping_label_url, created_at')
        .in('order_id', ids),
      supabase
        .from('shipping_labels')
        .select('id, order_id, carrier, tracking_number, tracking_url, label_url, status, label_cost, created_at')
        .in('order_id', ids),
    ]);

    // Resolve supplier + product names
    const wholesalerIds = Array.from(
      new Set([
        ...(items || []).map((i: any) => i.wholesaler_id).filter(Boolean),
        ...(fulfillments || []).map((f: any) => f.wholesaler_id).filter(Boolean),
      ])
    );
    const productIds = Array.from(new Set((items || []).map((i: any) => i.product_id).filter(Boolean)));

    const [{ data: whs }, { data: prods }] = await Promise.all([
      wholesalerIds.length
        ? supabase.from('wholesalers').select('id, name').in('id', wholesalerIds)
        : Promise.resolve({ data: [] as any[] }),
      productIds.length
        ? supabase.from('products_all').select('id, name').in('id', productIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const whName = new Map((whs || []).map((w: any) => [w.id, w.name]));
    const prodName = new Map((prods || []).map((p: any) => [p.id, p.name]));

    const byOrder: Record<string, OrderRow> = {};
    for (const o of orders || []) {
      byOrder[o.id] = { ...(o as any), items: [], fulfillments: [], labels: [] };
    }
    for (const i of items || []) {
      const row = byOrder[(i as any).order_id];
      if (!row) continue;
      row.items.push({
        ...(i as any),
        product_name: prodName.get((i as any).product_id),
        wholesaler_name: whName.get((i as any).wholesaler_id),
      });
    }
    for (const f of fulfillments || []) {
      const row = byOrder[(f as any).order_id];
      if (!row) continue;
      row.fulfillments.push({
        ...(f as any),
        wholesaler_name: whName.get((f as any).wholesaler_id),
      });
    }
    for (const l of labels || []) {
      const row = byOrder[(l as any).order_id];
      if (!row) continue;
      row.labels.push(l as any);
    }
    setRows(Object.values(byOrder));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const supplierOptions = useMemo(() => {
    const s = new Map<string, string>();
    rows.forEach((r) =>
      r.fulfillments.forEach((f) => {
        if (f.wholesaler_id) s.set(f.wholesaler_id, f.wholesaler_name || f.wholesaler_id.slice(0, 8));
      })
    );
    return Array.from(s.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      if (paymentFilter !== 'all' && (r.payment_status || 'pending') !== paymentFilter) return false;
      if (fulfillmentFilter !== 'all' && (r.fulfillment_status || 'pending') !== fulfillmentFilter) return false;
      if (supplierFilter !== 'all' && !r.fulfillments.some((f) => f.wholesaler_id === supplierFilter)) return false;
      if (dateRange !== 'all') {
        const days = dateRange === '7' ? 7 : dateRange === '30' ? 30 : dateRange === '90' ? 90 : 0;
        if (days && now - new Date(r.created_at).getTime() > days * 86400000) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          r.id,
          r.customer_email,
          r.customer_phone,
          ...r.items.map((i) => i.product_name),
          ...r.fulfillments.map((f) => f.wholesaler_name),
          ...r.fulfillments.map((f) => f.tracking_number),
          ...r.labels.map((l) => l.tracking_number),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, paymentFilter, fulfillmentFilter, supplierFilter, dateRange]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      unpaid: rows.filter((r) => (r.payment_status || 'pending') !== 'paid').length,
      pending_fulfillment: rows.filter((r) => (r.fulfillment_status || 'pending') !== 'fulfilled').length,
      revenue: rows.reduce((s, r) => s + Number(r.total || 0), 0),
    };
  }, [rows]);

  return (
    <div className="p-6 space-y-4">
      <DDAlertBar />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dynasty Direct — Orders</h1>
          <p className="text-sm text-muted-foreground">
            Unified view of every site order + fulfilling supplier + payment + tracking.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Orders</div>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Unpaid</div>
          <div className="text-2xl font-semibold text-destructive">{stats.unpaid}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pending Fulfillment</div>
          <div className="text-2xl font-semibold">{stats.pending_fulfillment}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Revenue (filtered)</div>
          <div className="text-2xl font-semibold">{fmtMoney(stats.revenue)}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search order id, email, supplier, tracking…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Payment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payment</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Unpaid / pending</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Fulfillment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fulfillment</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Supplier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {supplierOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Date" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Order #</th>
                <th className="p-3">Buyer</th>
                <th className="p-3">Items</th>
                <th className="p-3">Total</th>
                <th className="p-3">Supplier(s)</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Fulfillment</th>
                <th className="p-3">Tracking</th>
                <th className="p-3">Date</th>
                <th className="p-3">Invite</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No orders match the filters.</td></tr>
              )}
              {filtered.map((r) => {
                const unpaid = (r.payment_status || 'pending') !== 'paid';
                const suppliers = Array.from(new Set(r.fulfillments.map((f) => f.wholesaler_name).filter(Boolean))) as string[];
                const tracking = r.labels[0] || r.fulfillments[0];
                const tCarrier = (tracking as any)?.carrier ?? null;
                const tNum = (tracking as any)?.tracking_number ?? null;
                const tUrl =
                  (tracking as any)?.tracking_url ||
                  carrierTrackUrl(tCarrier, tNum);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`border-t cursor-pointer hover:bg-accent/40 ${unpaid ? 'font-bold' : ''}`}
                  >
                    <td className="p-3 font-mono text-xs">{r.id.slice(0, 8)}</td>
                    <td className="p-3">{r.customer_email || r.customer_phone || '—'}</td>
                    <td className="p-3">
                      {r.items.length} item{r.items.length !== 1 ? 's' : ''}
                      {r.items[0]?.product_name && (
                        <span className="text-xs text-muted-foreground block">
                          {r.items.map((i) => i.product_name || '?').join(', ').slice(0, 50)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{fmtMoney(r.total)}</td>
                    <td className="p-3">
                      {suppliers.length ? suppliers.join(', ') : <span className="text-muted-foreground">unrouted</span>}
                    </td>
                    <td className="p-3">
                      <Badge variant={unpaid ? 'destructive' : 'default'}>
                        {r.payment_status || 'pending'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{r.fulfillment_status || 'pending'}</Badge>
                    </td>
                    <td className="p-3">
                      {tNum ? (
                        tUrl ? (
                          <a
                            href={tUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {tNum} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="font-mono text-xs">{tNum}</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      {(r.customer_email || r.customer_phone) && (
                        <InviteButton
                          role="customer"
                          targetLink={{ order_id: r.id }}
                          defaultEmail={r.customer_email || ''}
                          defaultPhone={r.customer_phone || ''}
                          label="Invite"
                        />
                      )}
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <DDDrillMenu
                        label={`Order ${r.id.slice(0, 8)}`}
                        items={[
                          ddDrill.fulfillment(r.id),
                          ddDrill.customer(r.id),
                          ...Array.from(new Set(r.fulfillments.map((f) => f.wholesaler_id).filter(Boolean) as string[])).flatMap((whId) => {
                            const name = r.fulfillments.find((f) => f.wholesaler_id === whId)?.wholesaler_name;
                            return [
                              ddDrill.supplier(whId, name),
                              ddDrill.supplierOrders(whId),
                              ddDrill.inventory(whId),
                            ];
                          }),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Order {selected.id.slice(0, 8)}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-semibold">{fmtMoney(selected.total)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Date</div>
                    <div>{format(new Date(selected.created_at), 'PPpp')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Payment</div>
                    <Badge variant={(selected.payment_status || 'pending') !== 'paid' ? 'destructive' : 'default'}>
                      {selected.payment_status || 'pending'}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Fulfillment</div>
                    <Badge variant="outline">{selected.fulfillment_status || 'pending'}</Badge>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Buyer</div>
                    <div>{selected.customer_email || selected.customer_phone || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Type</div>
                    <div>{selected.order_type || '—'}</div>
                  </div>
                </div>

                {selected.shipping_address && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Ship to</div>
                    <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap">
                      {JSON.stringify(selected.shipping_address, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Items</div>
                  <div className="space-y-1">
                    {selected.items.map((i) => (
                      <div key={i.id} className="flex justify-between border-b py-1.5">
                        <div>
                          <div>{i.product_name || i.product_id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">
                            Supplier: {i.wholesaler_name || '—'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div>{i.qty} × {fmtMoney(i.price_each)}</div>
                          <div className="text-xs text-muted-foreground">
                            = {fmtMoney(i.qty * Number(i.price_each || 0))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Fulfillments ({selected.fulfillments.length})</div>
                  {selected.fulfillments.length === 0 && (
                    <div className="text-xs text-muted-foreground">No fulfillment rows yet.</div>
                  )}
                  {selected.fulfillments.map((f) => (
                    <div key={f.id} className="border rounded p-2 mb-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{f.wholesaler_name || f.wholesaler_id.slice(0, 8)}</span>
                        <Badge variant="outline">{f.status}</Badge>
                      </div>
                      {f.tracking_number && (
                        <div className="mt-1 text-muted-foreground">
                          {f.carrier} · {f.tracking_number}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Shipping labels ({selected.labels.length})</div>
                  {selected.labels.length === 0 && (
                    <div className="text-xs text-muted-foreground">No labels generated.</div>
                  )}
                  {selected.labels.map((l) => (
                    <div key={l.id} className="border rounded p-2 mb-2 text-xs flex items-center justify-between">
                      <div>
                        <div>{l.carrier} · {l.tracking_number}</div>
                        <div className="text-muted-foreground">
                          {l.status} · {fmtMoney(l.label_cost as any)}
                        </div>
                      </div>
                      {l.label_url && (
                        <a href={l.label_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          Label <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {selected.notes && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Notes</div>
                    <div className="text-sm">{selected.notes}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
