import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DollarSign, TrendingUp, Users, BarChart3, Target, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Store
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';

export default function DialerRevenueIntelligence() {
  const { currentBusiness } = useBusiness();

  // Sales funnel
  const { data: funnelData = [] } = useQuery({
    queryKey: ['sales-funnel', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_sales_funnel')
        .select('*');
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Rep close rates
  const { data: repCloseRates = [] } = useQuery({
    queryKey: ['rep-close-rates', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_rep_close_rate')
        .select('*');
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Revenue attribution (recent)
  const { data: recentRevenue = [] } = useQuery({
    queryKey: ['revenue-attribution', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('call_revenue_attribution')
        .select('*, store:store_master(store_name)')
        .order('attributed_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Store lifecycle distribution
  const { data: lifecycleData = [] } = useQuery({
    queryKey: ['store-lifecycle', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_answer_profile')
        .select('lifecycle_stage')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data || [])) {
        const stage = row.lifecycle_stage || 'cold';
        counts[stage] = (counts[stage] || 0) + 1;
      }
      return Object.entries(counts).map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count);
    },
    enabled: !!currentBusiness?.id,
  });

  // Totals
  const totalRevenue = funnelData.reduce((s: number, c: any) => s + Number(c.total_revenue || 0), 0);
  const totalOrders = funnelData.reduce((s: number, c: any) => s + Number(c.total_orders || 0), 0);
  const totalDials = funnelData.reduce((s: number, c: any) => s + Number(c.total_dials || 0), 0);
  const totalConnects = funnelData.reduce((s: number, c: any) => s + Number(c.total_answers || 0), 0);
  const avgCloseRate = totalConnects > 0 ? totalOrders / totalConnects : 0;

  const stageColors: Record<string, string> = {
    cold: 'bg-muted text-muted-foreground',
    contacted: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    interested: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    negotiating: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    customer: 'bg-primary/10 text-primary',
    repeat_customer: 'bg-primary/20 text-primary',
    inactive: 'bg-muted text-muted-foreground',
    do_not_call: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="w-full min-h-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6" /> Revenue Intelligence
        </h2>
        <p className="text-muted-foreground">Conversion capture, funnel analytics, and revenue attribution</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold text-primary">${totalRevenue.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalOrders}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{(avgCloseRate * 100).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Close Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalDials}</p>
            <p className="text-xs text-muted-foreground">Total Dials</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">${totalDials > 0 ? (totalRevenue / totalDials).toFixed(2) : '0.00'}</p>
            <p className="text-xs text-muted-foreground">Revenue/Dial</p>
          </CardContent>
        </Card>
      </div>

      {/* Store Lifecycle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5" /> Store Lifecycle Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lifecycleData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No lifecycle data yet</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {lifecycleData.map((item: any) => (
                <Badge key={item.stage} className={`text-sm px-3 py-1.5 ${stageColors[item.stage] || 'bg-muted'}`}>
                  {item.stage.replace(/_/g, ' ')} — {item.count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="funnel" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="funnel" className="gap-1"><BarChart3 className="h-3 w-3" /> Sales Funnel</TabsTrigger>
          <TabsTrigger value="reps" className="gap-1"><Users className="h-3 w-3" /> Rep Close Rates</TabsTrigger>
          <TabsTrigger value="attribution" className="gap-1"><DollarSign className="h-3 w-3" /> Revenue Log</TabsTrigger>
        </TabsList>

        {/* Sales Funnel */}
        <TabsContent value="funnel">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign Sales Funnel</CardTitle>
              <CardDescription>Dials → Answers → Interested → Orders → Revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {funnelData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No funnel data — dispositions populate this view</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Dials</TableHead>
                      <TableHead className="text-right">Answers</TableHead>
                      <TableHead className="text-right">Interested</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Close Rate</TableHead>
                      <TableHead className="text-right">$/Connect</TableHead>
                      <TableHead className="text-right">Profit/Connect</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnelData.map((c: any) => (
                      <TableRow key={c.campaign_id}>
                        <TableCell className="font-medium">{c.campaign_name || c.campaign_id?.substring(0, 8)}</TableCell>
                        <TableCell className="text-right">{c.total_dials}</TableCell>
                        <TableCell className="text-right">{c.total_answers}</TableCell>
                        <TableCell className="text-right">{c.total_interested}</TableCell>
                        <TableCell className="text-right font-bold">{c.total_orders}</TableCell>
                        <TableCell className="text-right text-primary font-bold">${Number(c.total_revenue).toFixed(0)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Number(c.close_rate) > 0.1 ? 'default' : 'secondary'}>
                            {(Number(c.close_rate) * 100).toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">${Number(c.revenue_per_connect).toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-bold ${Number(c.profit_per_connect) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          ${Number(c.profit_per_connect).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rep Close Rates */}
        <TabsContent value="reps">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rep Close Rate & Profitability</CardTitle>
              <CardDescription>Reps ranked by revenue-generating efficiency</CardDescription>
            </CardHeader>
            <CardContent>
              {repCloseRates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No rep data available</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rep</TableHead>
                      <TableHead className="text-right">Sessions</TableHead>
                      <TableHead className="text-right">Connects</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Close Rate</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="text-right">$/Hour</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...repCloseRates].sort((a: any, b: any) => Number(b.net_profit) - Number(a.net_profit)).map((r: any) => (
                      <TableRow key={r.rep_user_id}>
                        <TableCell className="font-medium">{r.rep_user_id?.substring(0, 8)}</TableCell>
                        <TableCell className="text-right">{r.total_sessions}</TableCell>
                        <TableCell className="text-right">{r.total_connects}</TableCell>
                        <TableCell className="text-right font-bold">{r.total_orders}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Number(r.close_rate) > 0.1 ? 'default' : 'secondary'}>
                            {(Number(r.close_rate) * 100).toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-primary">${Number(r.total_revenue).toFixed(0)}</TableCell>
                        <TableCell className={`text-right font-bold ${Number(r.net_profit) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          ${Number(r.net_profit).toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1">
                            {Number(r.profit_per_hour) >= 0 ? <ArrowUpRight className="h-3 w-3 text-primary" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
                            ${Number(r.profit_per_hour).toFixed(0)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Attribution Log */}
        <TabsContent value="attribution">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Revenue Attribution</CardTitle>
              <CardDescription>Last 20 revenue events linked to call sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No revenue attributed yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentRevenue.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.store?.store_name || r.store_id?.substring(0, 8)}</TableCell>
                        <TableCell className="text-right text-primary font-bold">${Number(r.revenue_amount).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-destructive">${Number(r.cost_amount).toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-bold ${Number(r.net_profit) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          ${Number(r.net_profit).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(r.attributed_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
