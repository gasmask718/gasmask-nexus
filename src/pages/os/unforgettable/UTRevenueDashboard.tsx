// ═══════════════════════════════════════════════════════════════════════════
// MON-02 — Revenue Dashboard. Three numbers, never one.
// Every figure traces to a query. No hardcoded constants, no estimated margins.
// Collected has no payment surface yet — see docs/architecture/MON-03.
// ═══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, AlertTriangle } from 'lucide-react';
import {
  isConfirmed,
  pipelineValue,
  contractedValue,
  isProfitIncomplete,
  unrecordedDeposits,
  lastWritten,
  formatLastUpdated,
  money,
} from './utRevenue';

export default function UTRevenueDashboard() {
  const {
    data: bookings,
    error: bookingsError,
    isLoading: bookingsLoading,
  } = useQuery({
    queryKey: ['ut-revenue-bookings'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_event_bookings' as any).select('*') as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const {
    data: shopOrders,
    error: shopError,
    isLoading: shopLoading,
  } = useQuery({
    queryKey: ['ut-revenue-shop-orders'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_orders' as any).select('*') as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const {
    data: kitOrders,
    error: kitError,
    isLoading: kitLoading,
  } = useQuery({
    queryKey: ['ut-revenue-kits'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_kit_orders' as any).select('*') as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const rows = bookings || [];
  const confirmed = rows.filter(isConfirmed);
  const unconfirmed = rows.filter((r) => !isConfirmed(r));

  const pipeline = unconfirmed.reduce((s, r) => s + pipelineValue(r), 0);
  const contracted = confirmed.reduce((s, r) => s + contractedValue(r), 0);
  const unrecorded = unrecordedDeposits(rows);

  // Shop / kit revenue: settled orders only.
  const shopPaid = (shopOrders || []).filter((o: any) => String(o.payment_status || '').toLowerCase() === 'paid');
  const shopRevenue = shopPaid.reduce((s: number, o: any) => s + Number(o.total_price || 0), 0);
  const kitRevenue = (kitOrders || []).reduce((s: number, k: any) => s + Number(k.total_paid || 0), 0);

  // Profit: read from the table. Never computed.
  const priced = rows.filter((r) => Number(r.full_price || 0) > 0);
  const incomplete = priced.filter(isProfitIncomplete);
  const withProfit = priced.filter((r) => !isProfitIncomplete(r));
  const grossProfit = withProfit.reduce((s, r) => s + Number(r.gross_profit || 0), 0);
  const netProfit = withProfit.reduce((s, r) => s + Number(r.net_profit || 0), 0);
  const vendorCost = withProfit.reduce((s, r) => s + Number(r.vendor_cost || 0), 0);

  const bookingsStamp = formatLastUpdated(lastWritten(rows));
  const shopStamp = formatLastUpdated(lastWritten(shopOrders));
  const kitStamp = formatLastUpdated(lastWritten(kitOrders));

  const err = (e: unknown) =>
    e ? <p className="text-xs text-destructive">Query failed: {(e as any)?.message || String(e)}</p> : null;

  const stamp = (text: string) => <p className="text-[11px] text-muted-foreground/70 mt-2">{text}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">💰 Revenue Dashboard</h1>
        <p className="text-muted-foreground">
          Pipeline, contracted and collected are three different questions. They are never added together.
        </p>
      </div>

      {(bookingsError || shopError || kitError) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Data could not be read
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {err(bookingsError)}
            {err(shopError)}
            {err(kitError)}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pipeline</p>
            <p className="text-3xl font-bold mt-1">{bookingsLoading ? '—' : money(pipeline)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {unconfirmed.length} unconfirmed booking{unconfirmed.length === 1 ? '' : 's'} — stated budget or quote,
              not agreed work
            </p>
            {stamp(`ut_event_bookings — ${bookingsStamp}`)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Contracted</p>
            <p className="text-3xl font-bold mt-1">{bookingsLoading ? '—' : money(contracted)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {confirmed.length} confirmed booking{confirmed.length === 1 ? '' : 's'} — full_price we agreed to deliver
            </p>
            {stamp(`ut_event_bookings — ${bookingsStamp}`)}
          </CardContent>
        </Card>

        <Card className="border-amber-500/40">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Collected</p>
            <p className="text-3xl font-bold mt-1">$0</p>
            <p className="text-xs text-muted-foreground mt-1">
              {unrecorded.length > 0
                ? `$0 collected — ${unrecorded.length} booking${unrecorded.length === 1 ? '' : 's'} marked ${[
                    ...new Set(unrecorded.map((r) => r.status)),
                  ].join(', ')} with no payment record.`
                : 'No settled payment record exists for event bookings.'}
            </p>
            {stamp('no payments surface — MON-03')}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🛍️</span>
              <p className="font-semibold">Shop Sales (settled)</p>
            </div>
            <p className="text-2xl font-bold">{shopLoading ? '—' : money(shopRevenue)}</p>
            <p className="text-xs text-muted-foreground">
              {shopPaid.length} paid of {(shopOrders || []).length} order{(shopOrders || []).length === 1 ? '' : 's'}
            </p>
            {stamp(`ut_orders — ${shopStamp}`)}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🚀</span>
              <p className="font-semibold">Kit Sales</p>
            </div>
            <p className="text-2xl font-bold">{kitLoading ? '—' : money(kitRevenue)}</p>
            <p className="text-xs text-muted-foreground">{(kitOrders || []).length} orders</p>
            {stamp(`ut_kit_orders — ${kitStamp}`)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Profit (read from the booking rows)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {priced.length === 0 ? (
            <p className="text-sm text-muted-foreground">No priced bookings.</p>
          ) : withProfit.length === 0 ? (
            <p className="text-sm">
              Not calculated — {incomplete.length} priced booking{incomplete.length === 1 ? '' : 's'} have{' '}
              <code className="text-xs">gross_profit = 0</code> against a non-zero{' '}
              <code className="text-xs">full_price</code>. Vendor cost and margin were never entered.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Vendor cost</span>
                <span>-{money(vendorCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Gross profit</span>
                <span className="font-bold">{money(grossProfit)}</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between text-green-500 font-bold text-lg">
                <span>Net profit</span>
                <span>{money(netProfit)}</span>
              </div>
              {incomplete.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Excludes {incomplete.length} priced booking{incomplete.length === 1 ? '' : 's'} with no profit math —
                  margin shown as not calculated.
                </p>
              )}
            </div>
          )}
          {stamp(`ut_event_bookings — ${bookingsStamp}`)}
        </CardContent>
      </Card>

      {incomplete.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Incomplete bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {incomplete.map((r) => (
              <div key={r.id} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                <span>
                  {r.name || r.package_name || 'Booking'} · {r.status}
                </span>
                <span className="text-muted-foreground">
                  {money(Number(r.full_price || 0))} · margin not calculated
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
