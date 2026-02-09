/**
 * Ambassador Profit Dashboard
 * Real profit visibility: Wholesale Cost → Retail Revenue → Net Profit
 * Data sourced from canonical views (v_ambassador_profit_dashboard, v_ambassador_profit_breakdown)
 * ⚠️ SECURITY: Ambassador sees ONLY their own profit data. No access to other ambassadors or global margins.
 */
import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, Package, BarChart3, Store, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAmbassadorProfitDashboard, useAmbassadorProfitBreakdown } from '@/hooks/useAmbassadorProfit';
import { format } from 'date-fns';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

function MarginBadge({ margin }: { margin: number }) {
  if (margin >= 20) return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">{margin}%</Badge>;
  if (margin >= 10) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">{margin}%</Badge>;
  return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">{margin}%</Badge>;
}

function ProfitContent() {
  const { data: summary, isLoading: summaryLoading } = useAmbassadorProfitDashboard();
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const filters = useMemo(() => ({
    brand: brandFilter !== 'all' ? brandFilter : undefined,
    store_id: storeFilter !== 'all' ? storeFilter : undefined,
    sale_channel: channelFilter !== 'all' ? channelFilter : undefined,
  }), [brandFilter, storeFilter, channelFilter]);

  const { data: breakdown, isLoading: breakdownLoading } = useAmbassadorProfitBreakdown(filters);

  // Extract unique filter options from unfiltered data
  const { data: allBreakdown } = useAmbassadorProfitBreakdown();
  const brands = useMemo(() => [...new Set((allBreakdown || []).map(r => r.brand).filter(Boolean))], [allBreakdown]);
  const stores = useMemo(() => {
    const map = new Map<string, string>();
    (allBreakdown || []).forEach(r => { if (r.store_id && r.store_name) map.set(r.store_id, r.store_name); });
    return Array.from(map.entries());
  }, [allBreakdown]);
  const channels = useMemo(() => [...new Set((allBreakdown || []).map(r => r.sale_channel).filter(Boolean))], [allBreakdown]);

  const isLoading = summaryLoading || breakdownLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const profit = summary?.total_profit || 0;
  const revenue = summary?.total_revenue || 0;
  const cost = summary?.total_wholesale_cost || 0;
  const margin = summary?.avg_margin_pct || 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(profit)}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Retail Revenue</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(revenue)}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <ArrowUpRight className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Wholesale Cost</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(cost)}</p>
              </div>
              <div className="p-3 rounded-full bg-red-500/10">
                <ArrowDownRight className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={margin >= 20 ? 'border-green-500/30' : margin >= 10 ? 'border-amber-500/30' : 'border-red-500/30'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Margin</p>
                <p className="text-2xl font-bold font-mono">{margin}%</p>
              </div>
              <div className="p-3 rounded-full bg-muted">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span>{summary?.total_units_sold || 0} units</span>
              <span>{summary?.stores_served || 0} stores</span>
              <span>{summary?.brands_sold || 0} brands</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Profit Breakdown
              </CardTitle>
              <CardDescription>By product, brand, store, and channel</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {brands.length > 0 && (
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {brands.map(b => <SelectItem key={b} value={b!}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {stores.length > 0 && (
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {channels.length > 0 && (
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    {channels.map(c => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(!breakdown || breakdown.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No profit data yet</p>
              <p className="text-sm">Start selling to stores in your portfolio to see your profits here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Wholesale Cost</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Month</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.brand || '-'}</TableCell>
                      <TableCell>{row.product_name || '-'}</TableCell>
                      <TableCell>{row.store_name || '-'}</TableCell>
                      <TableCell>
                        {row.sale_channel ? (
                          <Badge variant="outline" className="text-xs capitalize">{row.sale_channel}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">{row.units_sold}</TableCell>
                      <TableCell className="text-right font-mono text-red-500">{formatCurrency(row.wholesale_cost)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(row.retail_revenue)}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${row.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.net_profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <MarginBadge margin={row.margin_pct} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.sale_month ? format(new Date(row.sale_month), 'MMM yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AmbassadorProfitDashboard() {
  return (
    <PortalRBACGate allowedRoles={['ambassador', 'admin']} portalName="Ambassador Portal">
      <AmbassadorLayout
        title="Profit Dashboard"
        subtitle="Wholesale → Retail spread & margins"
        backPath="/ambassador/dashboard"
        portalIcon={<TrendingUp className="h-4 w-4 text-primary-foreground" />}
      >
        <div className="p-6">
          <ProfitContent />
        </div>
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
