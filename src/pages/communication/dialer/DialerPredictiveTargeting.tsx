import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Crosshair, TrendingUp, TrendingDown, Clock, Users, BarChart3,
  Zap, Star, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw,
  Target, DollarSign, Brain, Gauge
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

export default function DialerPredictiveTargeting() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const bizId = currentBusiness?.id;

  // Settings
  const { data: settings } = useQuery({
    queryKey: ['dialer-settings-pred', bizId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dialer_settings')
        .select('use_predictive_targeting, use_rep_store_matching, use_time_revenue_bias, auto_profit_protection')
        .eq('business_id', bizId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!bizId,
  });

  // Top predictive stores
  const { data: predStores = [] } = useQuery({
    queryKey: ['predictive-stores', bizId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('store_answer_profile')
        .select('store_id, predictive_profit_score, answer_rate, close_rate, lifetime_revenue, lifecycle_stage, total_attempts, total_answers')
        .order('predictive_profit_score', { ascending: false })
        .limit(25);
      return (data || []) as any[];
    },
    enabled: !!bizId,
  });

  // Disposition conversion stats
  const { data: dispStats = [] } = useQuery({
    queryKey: ['disposition-conversion', bizId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('v_disposition_conversion_stats')
        .select('*');
      return (data || []) as any[];
    },
    enabled: !!bizId,
  });

  // Revenue momentum
  const { data: momentum } = useQuery({
    queryKey: ['revenue-momentum', bizId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('v_revenue_momentum')
        .select('*')
        .eq('business_id', bizId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!bizId,
  });

  // Hourly revenue stats
  const { data: hourlyRevenue = [] } = useQuery({
    queryKey: ['hourly-revenue-stats', bizId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('store_hourly_revenue_stats')
        .select('hour_of_day, revenue, orders, attempts, revenue_per_attempt')
        .eq('business_id', bizId);
      // Aggregate by hour
      const byHour: Record<number, { revenue: number; orders: number; attempts: number }> = {};
      for (const row of (data || [])) {
        const h = row.hour_of_day;
        if (!byHour[h]) byHour[h] = { revenue: 0, orders: 0, attempts: 0 };
        byHour[h].revenue += Number(row.revenue) || 0;
        byHour[h].orders += Number(row.orders) || 0;
        byHour[h].attempts += Number(row.attempts) || 0;
      }
      return Object.entries(byHour)
        .map(([h, v]) => ({
          hour: parseInt(h),
          revenue: v.revenue,
          orders: v.orders,
          attempts: v.attempts,
          rpa: v.attempts > 0 ? v.revenue / v.attempts : 0,
        }))
        .sort((a, b) => b.rpa - a.rpa);
    },
    enabled: !!bizId,
  });

  // Campaign weights
  const { data: campaignWeights = [] } = useQuery({
    queryKey: ['campaign-weights', bizId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dialer_campaigns')
        .select('id, name, campaign_weight, status, auto_paused')
        .eq('business_id', bizId)
        .order('campaign_weight', { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!bizId,
  });

  // Recalculate predictive scores
  const recalc = useMutation({
    mutationFn: async () => {
      await supabase.rpc('calculate_predictive_profit_score' as any, { p_business_id: bizId });
      await supabase.rpc('auto_adjust_campaign_weights' as any, { p_business_id: bizId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictive-stores'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-weights'] });
      toast.success('Predictive scores & campaign weights recalculated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Toggle settings
  const toggleSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      await supabase.from('dialer_settings').update({ [key]: value, updated_at: new Date().toISOString() } as any).eq('business_id', bizId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dialer-settings-pred'] });
      toast.success('Setting updated');
    },
  });

  const momentumPct = Number(momentum?.momentum_pct || 0) * 100;
  const momentumPositive = momentumPct >= 0;

  return (
    <div className="w-full min-h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Crosshair className="h-6 w-6" /> Predictive Targeting Engine
          </h2>
          <p className="text-muted-foreground">Self-improving outreach — score stores, match reps, optimize timing, learn from outcomes</p>
        </div>
        <Button onClick={() => recalc.mutate()} disabled={recalc.isPending} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Recalculate All
        </Button>
      </div>

      {/* Revenue Momentum */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Gauge className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className={`text-2xl font-bold ${momentumPositive ? 'text-primary' : 'text-destructive'}`}>
              {momentumPositive ? '+' : ''}{momentumPct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">Revenue Momentum (7d vs 7d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">${Number(momentum?.last_7d_revenue || 0).toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Last 7d Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">${Number(momentum?.last_7d_profit || 0).toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Last 7d Profit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex flex-col items-center gap-1">
            {momentumPct < -15 && (
              <Badge variant="destructive" className="text-xs">⚠ Declining — consider volume increase</Badge>
            )}
            {momentumPct > 20 && (
              <Badge className="text-xs bg-primary">🚀 Growing — maintain & prioritize top campaigns</Badge>
            )}
            {momentumPct >= -15 && momentumPct <= 20 && (
              <Badge variant="secondary" className="text-xs">Stable</Badge>
            )}
            <p className="text-xs text-muted-foreground mt-1">Momentum Signal</p>
          </CardContent>
        </Card>
      </div>

      {/* Engine Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Predictive Targeting</p>
              <p className="text-xs text-muted-foreground">Sort queue by profit prediction score</p>
            </div>
            <Switch
              checked={settings?.use_predictive_targeting || false}
              onCheckedChange={(v) => toggleSetting.mutate({ key: 'use_predictive_targeting', value: v })}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Rep-Store Matching</p>
              <p className="text-xs text-muted-foreground">Route stores to reps with best close rate for lifecycle stage</p>
            </div>
            <Switch
              checked={settings?.use_rep_store_matching || false}
              onCheckedChange={(v) => toggleSetting.mutate({ key: 'use_rep_store_matching', value: v })}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Time-Revenue Bias</p>
              <p className="text-xs text-muted-foreground">Boost scores during historically profitable hours</p>
            </div>
            <Switch
              checked={settings?.use_time_revenue_bias || false}
              onCheckedChange={(v) => toggleSetting.mutate({ key: 'use_time_revenue_bias', value: v })}
            />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stores" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="stores" className="gap-1"><Star className="h-3 w-3" /> Predicted Stores</TabsTrigger>
          <TabsTrigger value="hours" className="gap-1"><Clock className="h-3 w-3" /> Revenue Hours</TabsTrigger>
          <TabsTrigger value="dispositions" className="gap-1"><BarChart3 className="h-3 w-3" /> Disposition Learning</TabsTrigger>
          <TabsTrigger value="weights" className="gap-1"><Target className="h-3 w-3" /> Campaign Weights</TabsTrigger>
        </TabsList>

        {/* Predicted Stores */}
        <TabsContent value="stores">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top 25 Predictive Profit Stores</CardTitle>
              <CardDescription>Scored by revenue (35%), close rate (25%), answer rate (15%), recency (10%), interest (10%)</CardDescription>
            </CardHeader>
            <CardContent>
              {predStores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No scored stores — click "Recalculate All" to generate</p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Close %</TableHead>
                        <TableHead className="text-right">Answer %</TableHead>
                        <TableHead>Stage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {predStores.map((s: any, i: number) => (
                        <TableRow key={s.store_id}>
                          <TableCell className="font-bold">{i + 1}</TableCell>
                          <TableCell className="font-medium">{s.store_id?.substring(0, 8)}…</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={Number(s.predictive_profit_score) > 30 ? 'default' : 'secondary'}>
                              {Number(s.predictive_profit_score).toFixed(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-primary">${Number(s.lifetime_revenue || 0).toFixed(0)}</TableCell>
                          <TableCell className="text-right">{(Number(s.close_rate || 0) * 100).toFixed(0)}%</TableCell>
                          <TableCell className="text-right">{(Number(s.answer_rate || 0) * 100).toFixed(0)}%</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{s.lifecycle_stage || 'cold'}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Hours */}
        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue by Hour of Day</CardTitle>
              <CardDescription>Hours ranked by revenue per attempt — higher means more profitable dialing</CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hourly revenue data yet</p>
              ) : (
                <div className="space-y-2">
                  {hourlyRevenue.map((h: any) => {
                    const label = h.hour > 12 ? `${h.hour - 12}:00 PM` : h.hour === 12 ? '12:00 PM' : h.hour === 0 ? '12:00 AM' : `${h.hour}:00 AM`;
                    const maxRpa = Math.max(...hourlyRevenue.map((x: any) => x.rpa), 1);
                    return (
                      <div key={h.hour} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-20">{label}</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(h.rpa / maxRpa) * 100}%` }} />
                        </div>
                        <span className="text-sm font-bold w-20 text-right">${h.rpa.toFixed(2)}/dial</span>
                        <span className="text-xs text-muted-foreground w-24 text-right">${h.revenue.toFixed(0)} | {h.orders} orders</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disposition Learning */}
        <TabsContent value="dispositions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Disposition Conversion Intelligence</CardTitle>
              <CardDescription>Which call outcomes actually convert to revenue?</CardDescription>
            </CardHeader>
            <CardContent>
              {dispStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No disposition data yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Disposition</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Sessions</TableHead>
                      <TableHead className="text-right">Converted</TableHead>
                      <TableHead className="text-right">Conv %</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">Avg Rev/Session</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispStats.map((d: any) => (
                      <TableRow key={d.disposition_id}>
                        <TableCell className="font-medium">{d.disposition_name}</TableCell>
                        <TableCell>
                          <Badge variant={d.category === 'positive' ? 'default' : d.category === 'negative' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                            {d.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{d.total_sessions}</TableCell>
                        <TableCell className="text-right">{d.converted_sessions}</TableCell>
                        <TableCell className="text-right font-bold">{(Number(d.conversion_rate) * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right text-primary">${Number(d.total_revenue).toFixed(0)}</TableCell>
                        <TableCell className="text-right">${Number(d.avg_revenue_per_session).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaign Weights */}
        <TabsContent value="weights">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dynamic Campaign Weights</CardTitle>
              <CardDescription>Auto-adjusted: winners get more volume (max 3.0×), losers get less (min 0.5×)</CardDescription>
            </CardHeader>
            <CardContent>
              {campaignWeights.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No campaigns configured</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignWeights.map((c: any) => (
                      <TableRow key={c.id} className={c.auto_paused ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Number(c.campaign_weight) >= 1.5 ? 'default' : Number(c.campaign_weight) <= 0.7 ? 'destructive' : 'secondary'}>
                            {Number(c.campaign_weight).toFixed(1)}×
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.auto_paused ? (
                            <Badge variant="destructive" className="text-xs">Auto-Paused</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs capitalize">{c.status}</Badge>
                          )}
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
