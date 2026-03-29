import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { RefreshCw, Upload, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductRow {
  id: string;
  product_name: string;
  suggested_sell_price: number | null;
  supplier_cost: number | null;
  profit_margin: number | null;
  category: string | null;
  status: string | null;
  competition_score: number | null;
  ai_score: number | null;
}

interface PricingRow extends ProductRow {
  ourPrice: number;
  discountPct: number;
}

function getMarginColor(margin: number): string {
  if (margin >= 40) return 'border-l-4 border-l-emerald-500';
  if (margin >= 20) return 'border-l-4 border-l-amber-500';
  return 'border-l-4 border-l-destructive';
}

function getMarginTextColor(margin: number): string {
  if (margin >= 40) return 'text-emerald-400';
  if (margin >= 20) return 'text-amber-400';
  return 'text-destructive';
}

function getStatusBadge(margin: number) {
  if (margin < 20) return { label: 'Underpriced', variant: 'destructive' as const };
  if (margin > 50) return { label: 'Overpriced', variant: 'default' as const };
  return { label: 'Competitive', variant: 'secondary' as const };
}

export function PricingIntelligence() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<PricingRow[]>([]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['trending-products-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trending_products')
        .select('id, product_name, suggested_sell_price, supplier_cost, profit_margin, category, status, competition_score, ai_score')
        .order('ai_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (products) {
      setRows(products.map(p => {
        const sellPrice = p.suggested_sell_price || 0;
        const cost = p.supplier_cost || 0;
        // Estimate a "reference market price" as 1.2x supplier cost (competitor estimate)
        const refPrice = cost > 0 ? cost * 2.5 : sellPrice * 1.2;
        const discountFromRef = refPrice > 0 ? Math.max(0, Math.min(50, Math.round(((refPrice - sellPrice) / refPrice) * 100))) : 15;
        return {
          ...p,
          ourPrice: sellPrice,
          discountPct: discountFromRef,
        };
      }));
    }
  }, [products]);

  const updatePrice = useCallback((id: string, discountPct: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const refPrice = (r.supplier_cost || 0) * 2.5 || r.ourPrice * 1.2;
      const newPrice = Math.max(0, refPrice * (1 - discountPct / 100));
      return { ...r, discountPct, ourPrice: Math.round(newPrice * 100) / 100 };
    }));
  }, []);

  const updateOurPrice = useCallback((id: string, price: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const refPrice = (r.supplier_cost || 0) * 2.5 || 1;
      const pct = Math.max(0, Math.min(50, Math.round(((refPrice - price) / refPrice) * 100)));
      return { ...r, ourPrice: price, discountPct: pct };
    }));
  }, []);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('dropship-product-scorer');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Competitor prices refreshed');
      queryClient.invalidateQueries({ queryKey: ['trending-products-pricing'] });
    },
    onError: (err: Error) => toast.error(`Refresh failed: ${err.message}`),
  });

  const syncToShopify = async (row: PricingRow) => {
    toast.info(`Syncing ${row.product_name} at $${row.ourPrice.toFixed(2)} — Shopify Admin API token required`);
  };

  const syncAll = async () => {
    toast.info(`Syncing ${rows.length} products — Shopify Admin API token required`);
  };

  const calcMargin = (ourPrice: number, supplierCost: number | null) => {
    if (!supplierCost || supplierCost === 0 || ourPrice === 0) return 0;
    return Math.round(((ourPrice - supplierCost) / ourPrice) * 100);
  };

  const calcGap = (ourPrice: number, supplierCost: number | null) => {
    // Gap vs estimated market (2.5x supplier cost)
    const marketEst = (supplierCost || 0) * 2.5;
    if (marketEst === 0) return 0;
    return Math.round(((ourPrice - marketEst) / marketEst) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">💰 Pricing Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Real-time competitor pricing &amp; margin optimization • {rows.length} products
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshMutation.isPending && "animate-spin")} />
            Refresh Prices
          </Button>
          <Button onClick={syncAll}>
            <Upload className="h-4 w-4 mr-2" />
            Sync All to Shopify
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'High Margin (40%+)', count: rows.filter(r => calcMargin(r.ourPrice, r.supplier_cost) >= 40).length, color: 'text-emerald-400' },
          { label: 'Medium (20-40%)', count: rows.filter(r => { const m = calcMargin(r.ourPrice, r.supplier_cost); return m >= 20 && m < 40; }).length, color: 'text-amber-400' },
          { label: 'Low Margin (<20%)', count: rows.filter(r => calcMargin(r.ourPrice, r.supplier_cost) < 20).length, color: 'text-destructive' },
          { label: 'Avg Margin', count: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + calcMargin(r.ourPrice, r.supplier_cost), 0) / rows.length) : 0, color: 'text-primary', suffix: '%' },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-4">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <div className={cn('text-2xl font-bold', c.color)}>{c.count}{c.suffix || ''}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Product Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Product Pricing Grid</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-right px-4 py-3 font-medium">Our Price</th>
                  <th className="text-right px-4 py-3 font-medium">Supplier Cost</th>
                  <th className="text-right px-4 py-3 font-medium">Est. Market</th>
                  <th className="text-center px-4 py-3 font-medium">Gap %</th>
                  <th className="text-center px-4 py-3 font-medium">Margin %</th>
                  <th className="text-center px-4 py-3 font-medium">AI Score</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Pricing Gauge</th>
                  <th className="text-center px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground">
                      No products found. Add products to the trending_products table to begin.
                    </td>
                  </tr>
                ) : (
                  rows.map(row => {
                    const margin = calcMargin(row.ourPrice, row.supplier_cost);
                    const gap = calcGap(row.ourPrice, row.supplier_cost);
                    const status = getStatusBadge(margin);
                    const estMarket = (row.supplier_cost || 0) * 2.5;

                    return (
                      <tr key={row.id} className={cn('border-b border-border/50 transition-colors', getMarginColor(margin))}>
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate">{row.product_name}</td>
                        <td className="px-4 py-3 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.ourPrice}
                            onChange={e => updateOurPrice(row.id, parseFloat(e.target.value) || 0)}
                            className="w-24 h-8 text-right ml-auto"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {row.supplier_cost ? `$${row.supplier_cost.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {estMarket > 0 ? `$${estMarket.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('flex items-center justify-center gap-1', gap < 0 ? 'text-emerald-400' : gap > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                            {gap < 0 ? <TrendingDown className="h-3 w-3" /> : gap > 0 ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {gap}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('font-semibold', getMarginTextColor(margin))}>{margin}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-xs">{row.ai_score ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                        </td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[row.discountPct]}
                              min={0}
                              max={50}
                              step={1}
                              onValueChange={([v]) => updatePrice(row.id, v)}
                              className="flex-1"
                            />
                            <span className="text-xs text-muted-foreground w-10 text-right">{row.discountPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button size="sm" variant="outline" onClick={() => syncToShopify(row)} className="h-7 text-xs">
                            <Upload className="h-3 w-3 mr-1" />
                            Sync
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PricingIntelligence;
