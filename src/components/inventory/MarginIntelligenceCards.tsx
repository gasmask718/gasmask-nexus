import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface MarginRow {
  product_id: string;
  product_name: string;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  margin_pct: number;
}

interface BrandMarginRow {
  brand_id: string | null;
  brand_name: string | null;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  margin_pct: number;
}

interface AlertRow {
  line_item_id: string;
  product_name: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
  alert_type: string;
}

function useMarginPerProduct() {
  return useQuery({
    queryKey: ['margin-per-product'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_margin_per_product' as any)
        .select('*')
        .order('total_profit', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MarginRow[];
    },
  });
}

function useMarginPerBrand() {
  return useQuery({
    queryKey: ['margin-per-brand'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_margin_per_brand' as any)
        .select('*')
        .order('total_profit', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BrandMarginRow[];
    },
  });
}

function useNegativeMarginAlerts() {
  return useQuery({
    queryKey: ['negative-margin-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_negative_margin_alerts' as any)
        .select('*')
        .order('margin_pct', { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as AlertRow[];
    },
  });
}

function formatCurrency(v: number) {
  return '$' + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(v: number) {
  return (v * 100).toFixed(1) + '%';
}

function MarginBadge({ pct }: { pct: number }) {
  if (pct < 0) return <Badge variant="destructive" className="font-mono">{formatPct(pct)}</Badge>;
  if (pct < 0.10) return <Badge variant="secondary" className="font-mono">{formatPct(pct)}</Badge>;
  if (pct < 0.20) return <Badge variant="outline" className="font-mono">{formatPct(pct)}</Badge>;
  return <Badge variant="default" className="font-mono">{formatPct(pct)}</Badge>;
}

// ─── Gross Margin Summary Card ──────────────────────────────────────────────

export function GrossMarginSummaryCard() {
  const { data: products, isLoading } = useMarginPerProduct();

  if (isLoading) return <Card><CardHeader><Skeleton className="h-5 w-48" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>;

  const totalRevenue = products?.reduce((s, r) => s + Number(r.total_revenue || 0), 0) ?? 0;
  const totalCogs = products?.reduce((s, r) => s + Number(r.total_cogs || 0), 0) ?? 0;
  const totalProfit = totalRevenue - totalCogs;
  const marginPct = totalRevenue > 0 ? totalProfit / totalRevenue : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-primary" />
          Gross Margin
          <MarginBadge pct={marginPct} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-lg font-bold font-mono">{formatCurrency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">COGS</p>
            <p className="text-lg font-bold font-mono">{formatCurrency(totalCogs)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gross Profit</p>
            <p className={`text-lg font-bold font-mono ${totalProfit < 0 ? 'text-destructive' : ''}`}>
              {totalProfit < 0 ? '-' : ''}{formatCurrency(totalProfit)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Top/Bottom Products ────────────────────────────────────────────────────

export function ProductMarginRankingCard() {
  const { data: products, isLoading } = useMarginPerProduct();

  if (isLoading) return <Card><CardHeader><Skeleton className="h-5 w-48" /></CardHeader><CardContent><div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card>;

  const sorted = [...(products || [])].sort((a, b) => Number(b.total_profit) - Number(a.total_profit));
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.filter(p => Number(p.total_profit) < 0).slice(-5).reverse();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Product Margins
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {top5.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">💰 Top Earners</p>
            <div className="space-y-1">
              {top5.map(p => (
                <div key={p.product_id} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                  <span className="text-sm truncate flex-1">{p.product_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">{formatCurrency(Number(p.total_profit))}</span>
                    <MarginBadge pct={Number(p.margin_pct)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {bottom5.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">🔥 Margin Leaks</p>
            <div className="space-y-1">
              {bottom5.map(p => (
                <div key={p.product_id} className="flex items-center justify-between p-2 rounded bg-destructive/10">
                  <span className="text-sm truncate flex-1">{p.product_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-destructive">{formatCurrency(Number(p.total_profit))}</span>
                    <MarginBadge pct={Number(p.margin_pct)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {(!products || products.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No margin data yet. Receive inventory and finalize invoices to populate.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Brand Margins ──────────────────────────────────────────────────────────

export function BrandMarginCard() {
  const { data: brands, isLoading } = useMarginPerBrand();

  if (isLoading) return <Card><CardHeader><Skeleton className="h-5 w-48" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-primary" />
          Brand Margins
        </CardTitle>
      </CardHeader>
      <CardContent>
        {brands && brands.length > 0 ? (
          <div className="space-y-2">
            {brands.map(b => (
              <div key={b.brand_id || 'unknown'} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                <span className="text-sm font-medium">{b.brand_name || 'Unknown'}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Rev: {formatCurrency(Number(b.total_revenue))}</span>
                  <span className="text-xs text-muted-foreground">Profit: {formatCurrency(Number(b.total_profit))}</span>
                  <MarginBadge pct={Number(b.margin_pct)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No brand margin data yet</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Margin Alerts ──────────────────────────────────────────────────────────

export function MarginAlertsCard() {
  const { data: alerts, isLoading } = useNegativeMarginAlerts();

  if (isLoading) return <Card><CardHeader><Skeleton className="h-5 w-48" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>;

  const alertTypeLabels: Record<string, { label: string; variant: 'destructive' | 'secondary' | 'outline' }> = {
    negative_margin: { label: 'Negative', variant: 'destructive' },
    thin_margin: { label: 'Thin (<10%)', variant: 'secondary' },
    unknown_cost: { label: 'No Cost Data', variant: 'outline' },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Margin Alerts
          {alerts && alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts && alerts.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {alerts.map(a => {
              const config = alertTypeLabels[a.alert_type] || alertTypeLabels.thin_margin;
              return (
                <div key={a.line_item_id} className="flex items-center justify-between p-2 rounded bg-destructive/5">
                  <div className="flex-1">
                    <span className="text-sm">{a.product_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      Rev: {formatCurrency(Number(a.revenue))} / COGS: {formatCurrency(Number(a.cogs))}
                    </span>
                  </div>
                  <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">🎉 No margin alerts — all healthy</p>
        )}
      </CardContent>
    </Card>
  );
}
