import { Flame, TrendingUp, TrendingDown, Minus, Snowflake, Boxes, Calendar, DollarSign, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreTubeSummary } from '@/hooks/useStoreTubeSummary';
import { useStoreTubeBrandsKpi } from '@/hooks/useStoreTubeBrandsKpi';
import { useStoreInventoryBySku } from '@/hooks/useStoreInventoryBySku';
import { useStoreLifetimeByBrand } from '@/hooks/useStoreLifetimeByBrand';
import { useStoreSoldByBrandWindow } from '@/hooks/useStoreSoldByBrandWindow';
import { useStoreRecentInvoices } from '@/hooks/useStoreRecentInvoices';
import { ExpandableChipCard } from './ExpandableChipCard';
import { dynastyDate, dynastyRelative } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { getSkuStatusIcon, getSkuStatusLabel, brandDisplayName } from '@/lib/inventory/skuDisplay';

function getStockStatusDot(tubes: number) {
  if (tubes === 0) return '🔴';
  if (tubes <= 50) return '🟡';
  if (tubes <= 200) return '🟢';
  return '🔵';
}
function getStockStatusColor(tubes: number) {
  if (tubes === 0) return 'text-rose-500';
  if (tubes <= 50) return 'text-amber-500';
  if (tubes <= 200) return 'text-emerald-600';
  return 'text-blue-600';
}

interface Props { storeId: string }

const BRAND_COLORS: Record<string, string> = {
  gasmask: 'bg-red-500',
  'gasmask-tubes': 'bg-red-500',
  'gasmask tubes': 'bg-red-500',
  'gasmask talsm': 'bg-red-700',
  hotmama: 'bg-pink-500',
  'hot mama': 'bg-pink-500',
  grabba: 'bg-purple-500',
  'grabba-r-us': 'bg-purple-500',
  'grabba r us': 'bg-purple-500',
  hotscolatti: 'bg-orange-500',
  'hot scalati': 'bg-orange-500',
};

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString();

export function TubesSoldHeroStrip({ storeId }: Props) {
  const summary = useStoreTubeSummary(storeId);
  const brands = useStoreTubeBrandsKpi(storeId);
  const inventoryByBrand = useStoreInventoryBySku(storeId);
  const lifetimeByBrand = useStoreLifetimeByBrand(storeId);
  const last30ByBrand = useStoreSoldByBrandWindow(storeId, 'last_30_days');
  const priorMonthByBrand = useStoreSoldByBrandWindow(storeId, 'prior_month');
  const recentInvoices = useStoreRecentInvoices(storeId, 5);

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  if (summary.error) {
    return <Card><CardContent className="p-4 text-sm text-destructive">Failed to load tube summary: {(summary.error as Error).message}</CardContent></Card>;
  }

  const s = summary.data;
  if (!s) return null;

  const lifetime = Number(s.lifetime_tubes_sold ?? s.lifetime_tubes_delivered ?? 0);
  const lifetimeRevenue = Number(s.lifetime_invoice_revenue || 0);
  const invoiceCount = Number(s.invoice_count || 0);
  const thisMonth = Number(s.tubes_this_month || 0);
  const last30 = Number(s.tubes_last_30_days || 0);
  const onHand = Number(s.current_inventory_count || 0);
  const momPct = s.tubes_mom_delta_pct;
  const priorMonthTotal = (priorMonthByBrand.data ?? []).reduce((a, b) => a + b.tubes, 0);
  const lifetimeRowsTotal = (lifetimeByBrand.data ?? []).reduce((a, b) => a + b.tubes, 0);
  const last30RowsTotal = (last30ByBrand.data ?? []).reduce((a, b) => a + b.tubes, 0);

  // MoM subtitle
  let momLabel = 'no prior month data';
  let momIcon = <Minus className="h-3 w-3" />;
  let momClass = 'text-muted-foreground';
  if (momPct !== null && momPct !== undefined) {
    const v = Number(momPct);
    if (v > 0) { momLabel = `+${v}% vs last month`; momIcon = <TrendingUp className="h-3 w-3" />; momClass = 'text-emerald-600'; }
    else if (v < 0) { momLabel = `${v}% vs last month`; momIcon = <TrendingDown className="h-3 w-3" />; momClass = 'text-red-600'; }
    else { momLabel = 'flat vs last month'; momIcon = <Minus className="h-3 w-3" />; momClass = 'text-muted-foreground'; }
  }

  // Velocity
  let velLabel = '🧊 cold';
  let velClass = 'text-muted-foreground';
  if (last30 > 100) { velLabel = '🔥 hot velocity'; velClass = 'text-red-600'; }
  else if (last30 >= 50) { velLabel = '→ steady'; velClass = 'text-emerald-600'; }
  else if (last30 > 0)  { velLabel = '↓ cooling';   velClass = 'text-amber-600'; }

  const restockMap: Record<string, { label: string; cls: string }> = {
    out_of_stock: { label: 'OUT OF STOCK',  cls: 'text-red-600' },
    restock_now:  { label: 'restock now',   cls: 'text-amber-600' },
    restock_soon: { label: 'restock soon',  cls: 'text-amber-500' },
    stocked:      { label: 'stocked',       cls: 'text-emerald-600' },
  };
  const restock = restockMap[s.restock_status || ''] || { label: s.restock_status || '—', cls: 'text-muted-foreground' };

  // Brand bar — canonical invoice-derived lifetime (same source as the
  // "Lifetime sold" chip), rolled up by parent brand. The tube_sale_ledger
  // KPI path double-counted brands that map to multiple SKU rows.
  const brandTotals = new Map<string, number>();
  (lifetimeByBrand.data ?? []).forEach((r) => {
    if (!r.tubes) return;
    brandTotals.set(r.parent_brand, (brandTotals.get(r.parent_brand) ?? 0) + r.tubes);
  });
  const brandRows = Array.from(brandTotals.entries())
    .map(([brand_name, sold_lifetime]) => ({ brand_id: brand_name, brand_name, sold_lifetime }))
    .sort((a, b) => b.sold_lifetime - a.sold_lifetime);
  const brandTotal = brandRows.reduce((acc, b) => acc + b.sold_lifetime, 0);


  const brandInventory = inventoryByBrand.data ?? [];
  const lifetimeRows = lifetimeByBrand.data ?? [];
  const last30Rows = last30ByBrand.data ?? [];
  const priorMonthRows = priorMonthByBrand.data ?? [];
  const invoiceRows = recentInvoices.data ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* CHIP 1 — Lifetime Sold */}
        <ExpandableChipCard
          ariaLabel="Lifetime sold breakdown"
          expandedTitle="Lifetime by SKU"
          isLoading={lifetimeByBrand.isLoading}
          isEmpty={!lifetimeByBrand.isLoading && lifetimeRows.length === 0}
          emptyMessage="No invoiced tubes yet."
          collapsedView={
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-red-500/15">
                <Flame className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-red-600">{fmt(lifetime)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Lifetime sold{s.top_brand ? ` • ${s.top_brand}` : ''}
                </p>
              </div>
            </div>
          }
          expandedView={
            <>
              <div className="space-y-1.5">
                {lifetimeRows.map(b => (
                  <div key={b.product_id} className="flex items-center justify-between text-xs gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] shrink-0">{getSkuStatusIcon(b.status)}</span>
                      <span className="truncate">{b.display}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {b.tubes > 0 ? (
                        <>
                          <span className="font-semibold tabular-nums text-red-600">{fmt(b.tubes)}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{b.percentage}%</span>
                        </>
                      ) : (
                        <span className="text-[10px] italic text-muted-foreground">{getSkuStatusLabel(b.status, b.inventory_count)}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</span>
                <span className="text-sm font-bold text-red-600">{fmt(lifetimeRowsTotal)}</span>
              </div>
            </>
          }
        />

        {/* CHIP 2 — This Month / MoM */}
        <ExpandableChipCard
          ariaLabel="Prior month sold breakdown"
          expandedTitle="Prior Month by SKU"
          isLoading={priorMonthByBrand.isLoading}
          isEmpty={!priorMonthByBrand.isLoading && priorMonthRows.length === 0}
          emptyMessage="No sales in prior month."
          collapsedView={
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-red-500/10">
                <Calendar className="h-5 w-5 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{fmt(thisMonth)}</p>
                <p className={cn('text-xs flex items-center gap-1', momClass)}>
                  {momIcon} <span className="truncate">{momLabel}</span>
                </p>
              </div>
            </div>
          }
          expandedView={
            <>
              <div className="space-y-1.5">
                {priorMonthRows.map(b => (
                  <div key={b.product_id} className="flex items-center justify-between text-xs gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] shrink-0">{getSkuStatusIcon(b.status)}</span>
                      <span className="truncate">{b.display}</span>
                    </span>
                    {b.tubes > 0 ? (
                      <span className="font-semibold tabular-nums">{fmt(b.tubes)}</span>
                    ) : (
                      <span className="text-[10px] italic text-muted-foreground">{getSkuStatusLabel(b.status, b.inventory_count)}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</span>
                <span className="text-sm font-bold">{fmt(priorMonthTotal)}</span>
              </div>
              {momPct != null && (
                <p className={cn('text-[10px] italic', momClass)}>{momLabel}</p>
              )}
            </>
          }
        />

        {/* CHIP 3 — Last 30 Days */}
        <ExpandableChipCard
          ariaLabel="Last 30 days breakdown"
          expandedTitle="Last 30 Days by SKU"
          isLoading={last30ByBrand.isLoading}
          isEmpty={!last30ByBrand.isLoading && last30Rows.length === 0}
          emptyMessage="No deliveries in the last 30 days."
          collapsedView={
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-red-500/10">
                {last30 > 0 ? <Flame className="h-5 w-5 text-red-500" /> : <Snowflake className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{fmt(last30)}</p>
                <p className={cn('text-xs', velClass)}>{velLabel} • last 30d</p>
              </div>
            </div>
          }
          expandedView={
            <>
              <div className="space-y-1.5">
                {last30Rows.map(b => (
                  <div key={b.product_id} className="flex items-center justify-between text-xs gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] shrink-0">{getSkuStatusIcon(b.status)}</span>
                      <span className="truncate">{b.display}</span>
                    </span>
                    {b.tubes > 0 ? (
                      <span className="font-semibold tabular-nums">{fmt(b.tubes)}</span>
                    ) : (
                      <span className="text-[10px] italic text-muted-foreground">{getSkuStatusLabel(b.status, b.inventory_count)}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</span>
                  <span className="text-sm font-bold">{fmt(last30RowsTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                  <span className={cn('text-xs', velClass)}>{velLabel}</span>
                </div>
              </div>
            </>
          }
        />

        {/* CHIP 4 — On Hand / Stocked */}
        <ExpandableChipCard
          ariaLabel="Stock breakdown"
          expandedTitle="Stock Breakdown"
          isLoading={inventoryByBrand.isLoading}
          isEmpty={!inventoryByBrand.isLoading && brandInventory.every(b => b.status === 'never_offered')}
          emptyMessage="No inventory data yet. Log via Tube Intelligence below ↓"
          collapsedView={
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-blue-500/15">
                <Boxes className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-blue-600">{fmt(onHand)}</p>
                <p className="text-xs text-muted-foreground">total on hand · units</p>
                <p className={cn('text-[11px]', restock.cls)}>{restock.label}</p>
              </div>

            </div>
          }
          expandedView={
            <>
              <div className="space-y-1.5">
                {brandInventory.map(b => (
                  <div key={b.product_id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] shrink-0">{getSkuStatusIcon(b.status)}</span>
                      <span className="truncate max-w-[140px]">{b.display}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn('font-semibold tabular-nums', getStockStatusColor(b.tubes_remaining))}>
                        {b.tubes_remaining}
                      </span>
                      <span className="text-[10px]">{getStockStatusDot(b.tubes_remaining)}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</span>
                  <span className="text-sm font-bold text-blue-600">{fmt(onHand)} tubes</span>
                </div>
                {(() => {
                  const latest = brandInventory.map(b => b.last_updated).filter((d): d is string => !!d).sort().reverse()[0];
                  return latest ? (
                    <p className="text-[10px] text-muted-foreground">Updated {dynastyRelative(latest)}</p>
                  ) : null;
                })()}
              </div>
            </>
          }
        />

        {/* CHIP 5 — Revenue / Recent Invoices */}
        <ExpandableChipCard
          ariaLabel="Recent invoices"
          expandedTitle={`Recent Invoices${invoiceRows.length ? ` (${invoiceRows.length})` : ''}`}
          isLoading={recentInvoices.isLoading}
          isEmpty={!recentInvoices.isLoading && invoiceRows.length === 0}
          emptyMessage="No invoices yet."
          collapsedView={
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-500/15">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-emerald-600">${lifetimeRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {invoiceCount.toLocaleString()} invoice{invoiceCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          }
          expandedView={
            <>
              <div className="space-y-1.5">
                {invoiceRows.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{dynastyDate(inv.created_at)}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {inv.boxes > 0 ? `${inv.boxes} box${inv.boxes === 1 ? '' : 'es'}` : '—'}
                        {inv.brand ? ` • ${inv.brand}` : ''}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-emerald-600 shrink-0">
                      ${inv.total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lifetime</span>
                  <span className="text-sm font-bold text-emerald-600">${lifetimeRevenue.toLocaleString()}</span>
                </div>
                {invoiceCount > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Avg per invoice: ${Math.round(lifetimeRevenue / invoiceCount).toLocaleString()}
                  </p>
                )}
              </div>
            </>
          }
        />
      </div>

      {brandTotal > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Lifetime Sold by Brand</p>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {brandRows.filter(b => b.sold_lifetime > 0).map(b => {
                const key = (b.brand_id || b.brand_name || '').toLowerCase().trim();
                const color = BRAND_COLORS[key] || BRAND_COLORS[(b.brand_name || '').toLowerCase().trim()] || 'bg-muted-foreground';
                const pct = (b.sold_lifetime / brandTotal) * 100;
                return (
                  <div
                    key={b.brand_id || b.brand_name}
                    className={cn('h-full', color)}
                    style={{ width: `${pct}%` }}
                    title={`${brandDisplayName(b.brand_name)}: ${fmt(b.sold_lifetime)} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {brandRows.filter(b => b.sold_lifetime > 0).map(b => {
                const key = (b.brand_id || b.brand_name || '').toLowerCase().trim();
                const color = BRAND_COLORS[key] || BRAND_COLORS[(b.brand_name || '').toLowerCase().trim()] || 'bg-muted-foreground';
                return (
                  <span key={b.brand_id || b.brand_name} className="text-xs flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', color)} />
                    <span>{brandDisplayName(b.brand_name)}</span>
                    <span className="text-muted-foreground">{fmt(b.sold_lifetime)}</span>
                  </span>
                );
              })}
            </div>
            {lifetime > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 italic">
                Brand attribution available for {Math.min(100, Math.round((brandTotal / lifetime) * 100))}% of lifetime tubes. Historical operator-verified attributions don't include per-brand detail.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TubesSoldHeroStrip;
