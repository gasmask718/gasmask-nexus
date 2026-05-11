import { useState } from 'react';
import { Flame, TrendingUp, TrendingDown, Minus, Snowflake, Boxes, Calendar, DollarSign, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileStatCard } from '@/components/profile/ProfileStatCard';
import { useStoreTubeSummary } from '@/hooks/useStoreTubeSummary';
import { useStoreTubeBrandsKpi } from '@/hooks/useStoreTubeBrandsKpi';
import { useStoreInventoryByBrand } from '@/hooks/useStoreInventoryByBrand';
import { dynastyRelative } from '@/lib/dates';
import { cn } from '@/lib/utils';

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

  // Brand bar
  const brandRows = brands.data || [];
  const brandTotal = brandRows.reduce((acc, b) => acc + (b.sold_lifetime || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-red-500/15">
                <Flame className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-red-600">{fmt(lifetime)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Lifetime sold{s.top_brand ? ` • ${s.top_brand} primary` : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-red-500/10">
                {last30 > 0 ? <Flame className="h-5 w-5 text-red-500" /> : <Snowflake className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{fmt(last30)}</p>
                <p className={cn('text-xs', velClass)}>{velLabel} • last 30d</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-blue-500/15">
                <Boxes className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-blue-600">{fmt(onHand)}</p>
                <p className={cn('text-xs', restock.cls)}>{restock.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
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
                    title={`${b.brand_name}: ${fmt(b.sold_lifetime)} (${pct.toFixed(1)}%)`}
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
                    <span className="capitalize">{b.brand_name}</span>
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
