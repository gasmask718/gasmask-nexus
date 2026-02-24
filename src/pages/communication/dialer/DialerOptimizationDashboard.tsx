import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Brain, TrendingUp, Clock, Users, BarChart3, Zap,
  Star, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw, Target
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

export default function DialerOptimizationDashboard() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  // Top priority stores
  const { data: priorityStores = [] } = useQuery({
    queryKey: ['store-priority', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_store_priority_ranking')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Best dialing hours
  const { data: hourlyStats = [] } = useQuery({
    queryKey: ['hourly-answer-stats', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_hourly_answer_stats')
        .select('hour_of_day, attempts, answers, answer_rate')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      // Aggregate by hour
      const byHour: Record<number, { attempts: number; answers: number }> = {};
      for (const row of (data || [])) {
        const h = row.hour_of_day;
        if (!byHour[h]) byHour[h] = { attempts: 0, answers: 0 };
        byHour[h].attempts += row.attempts || 0;
        byHour[h].answers += row.answers || 0;
      }
      return Object.entries(byHour)
        .map(([h, v]) => ({
          hour: parseInt(h),
          attempts: v.attempts,
          answers: v.answers,
          rate: v.attempts > 0 ? v.answers / v.attempts : 0,
        }))
        .sort((a, b) => b.rate - a.rate);
    },
    enabled: !!currentBusiness?.id,
  });

  // Campaign optimization
  const { data: campaignOpt = [] } = useQuery({
    queryKey: ['campaign-optimization', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_campaign_optimization')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .order('net_profit', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Rep efficiency
  const { data: repMetrics = [] } = useQuery({
    queryKey: ['rep-efficiency', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_rep_profit_metrics')
        .select('*')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Rolling connect rate
  const { data: rollingRate } = useQuery({
    queryKey: ['rolling-connect-rate', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rolling_connect_rate' as any, {
        p_business_id: currentBusiness?.id,
        p_window: 100,
      });
      if (error) return 0.18;
      return Number(data) || 0.18;
    },
    enabled: !!currentBusiness?.id,
  });

  // Dialer settings
  const { data: settings } = useQuery({
    queryKey: ['dialer-settings-opt', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dialer_settings')
        .select('use_dynamic_connect_rate, auto_profit_protection, connect_rate_target')
        .eq('business_id', currentBusiness?.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!currentBusiness?.id,
  });

  // Recalculate priorities
  const recalcPriorities = useMutation({
    mutationFn: async () => {
      await supabase.rpc('calculate_store_priority' as any, { p_business_id: currentBusiness?.id });
      await supabase.rpc('calculate_rep_efficiency' as any, { p_business_id: currentBusiness?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-priority'] });
      queryClient.invalidateQueries({ queryKey: ['rep-efficiency'] });
      toast.success('Priorities & efficiency scores recalculated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Toggle settings
  const toggleSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { error } = await supabase
        .from('dialer_settings')
        .update({ [key]: value, updated_at: new Date().toISOString() } as any)
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dialer-settings-opt'] });
      toast.success('Setting updated');
    },
  });

  // Recommendations
  const recommendations = useMemo(() => {
    const recs: Array<{ text: string; type: 'success' | 'warning' | 'info' }> = [];

    // Best hour
    if (hourlyStats.length > 0 && hourlyStats[0].rate > 0) {
      const bestHour = hourlyStats[0].hour;
      const formatted = bestHour > 12 ? `${bestHour - 12}pm` : bestHour === 12 ? '12pm' : `${bestHour}am`;
      recs.push({ text: `Best dialing hour: ${formatted} (${(hourlyStats[0].rate * 100).toFixed(0)}% answer rate)`, type: 'success' });
    }

    // Underperforming campaigns
    const negCampaigns = campaignOpt.filter((c: any) => Number(c.net_profit) < 0 && Number(c.total_calls) > 50);
    if (negCampaigns.length > 0) {
      recs.push({ text: `${negCampaigns.length} campaign(s) with negative profit — consider pausing`, type: 'warning' });
    }

    // Top rep
    if (repMetrics.length > 0) {
      const sorted = [...repMetrics].sort((a: any, b: any) => Number(b.profit_per_hour) - Number(a.profit_per_hour));
      if (sorted.length > 0 && Number(sorted[0].profit_per_hour) > 0) {
        const topRep = sorted[0];
        recs.push({ text: `Top rep generating $${Number(topRep.profit_per_hour).toFixed(0)}/hr profit`, type: 'info' });
      }
    }

    // Dynamic connect rate
    if (rollingRate && Math.abs(rollingRate - 0.18) > 0.05) {
      recs.push({ text: `Rolling connect rate: ${(rollingRate * 100).toFixed(1)}% — ${rollingRate > 0.18 ? 'above' : 'below'} baseline`, type: rollingRate > 0.18 ? 'success' : 'warning' });
    }

    return recs;
  }, [hourlyStats, campaignOpt, repMetrics, rollingRate]);

  return (
    <div className="w-full min-h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" /> Optimization Intelligence
          </h2>
          <p className="text-muted-foreground">Self-learning dialer — priorities, timing, budgeting, and profit protection</p>
        </div>
        <Button onClick={() => recalcPriorities.mutate()} disabled={recalcPriorities.isPending} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Recalculate Scores
        </Button>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" /> AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                  rec.type === 'success' ? 'bg-primary/10 text-primary' :
                  rec.type === 'warning' ? 'bg-destructive/10 text-destructive' :
                  'bg-muted text-foreground'
                }`}>
                  {rec.type === 'success' ? <ArrowUpRight className="h-4 w-4 flex-shrink-0" /> :
                   rec.type === 'warning' ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> :
                   <TrendingUp className="h-4 w-4 flex-shrink-0" />}
                  <span>{rec.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engine toggles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dynamic Connect Rate</p>
              <p className="text-xs text-muted-foreground">Auto-adjust dial volume based on last 100 calls</p>
            </div>
            <Switch
              checked={settings?.use_dynamic_connect_rate || false}
              onCheckedChange={(v) => toggleSetting.mutate({ key: 'use_dynamic_connect_rate', value: v })}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-Profit Protection</p>
              <p className="text-xs text-muted-foreground">Throttle when losing money, pause bad campaigns</p>
            </div>
            <Switch
              checked={settings?.auto_profit_protection || false}
              onCheckedChange={(v) => toggleSetting.mutate({ key: 'auto_profit_protection', value: v })}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{((rollingRate || 0.18) * 100).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Rolling Connect Rate (100 calls)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="priority" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="priority" className="gap-1"><Star className="h-3 w-3" /> Priority Stores</TabsTrigger>
          <TabsTrigger value="hours" className="gap-1"><Clock className="h-3 w-3" /> Best Hours</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1"><BarChart3 className="h-3 w-3" /> Campaign Ranking</TabsTrigger>
          <TabsTrigger value="reps" className="gap-1"><Users className="h-3 w-3" /> Rep Efficiency</TabsTrigger>
        </TabsList>

        {/* Priority Stores */}
        <TabsContent value="priority">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top 20 Priority Stores</CardTitle>
              <CardDescription>Scored by revenue (40%), answer rate (30%), interest (20%), recency (10%)</CardDescription>
            </CardHeader>
            <CardContent>
              {priorityStores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No scored stores — click "Recalculate Scores" to generate</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead className="text-right">Priority</TableHead>
                      <TableHead className="text-right">Answer Rate</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Attempts</TableHead>
                      <TableHead className="text-right">Last Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priorityStores.map((store: any, i: number) => (
                      <TableRow key={store.store_id}>
                        <TableCell className="font-bold">{i + 1}</TableCell>
                        <TableCell className="font-medium">{store.store_name || store.store_id?.substring(0, 8)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Number(store.priority_score) > 50 ? 'default' : 'secondary'}>
                            {Number(store.priority_score).toFixed(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{(Number(store.answer_rate) * 100).toFixed(0)}%</TableCell>
                        <TableCell className="text-right text-primary">${Number(store.lifetime_revenue).toFixed(0)}</TableCell>
                        <TableCell className="text-right">{store.total_attempts}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {store.last_attempt_at ? new Date(store.last_attempt_at).toLocaleDateString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Best Hours */}
        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Best Dialing Hours</CardTitle>
              <CardDescription>Hours ranked by empirical answer rate across all stores</CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hourly data yet — stats populate after calls</p>
              ) : (
                <div className="space-y-2">
                  {hourlyStats.map((h: any) => {
                    const pct = h.rate * 100;
                    const label = h.hour > 12 ? `${h.hour - 12}:00 PM` : h.hour === 12 ? '12:00 PM' : h.hour === 0 ? '12:00 AM' : `${h.hour}:00 AM`;
                    return (
                      <div key={h.hour} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-20">{label}</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min(pct * 2, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold w-16 text-right">{pct.toFixed(0)}%</span>
                        <span className="text-xs text-muted-foreground w-24 text-right">{h.answers}/{h.attempts} calls</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaign Ranking */}
        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign Profit Ranking</CardTitle>
              <CardDescription>Sorted by net profit — auto-paused campaigns flagged</CardDescription>
            </CardHeader>
            <CardContent>
              {campaignOpt.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No campaign data available</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignOpt.map((c: any) => (
                      <TableRow key={c.campaign_id} className={c.auto_paused ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{c.campaign_name}</TableCell>
                        <TableCell className="text-right">{Number(c.campaign_weight).toFixed(1)}x</TableCell>
                        <TableCell className="text-right text-primary">${Number(c.revenue).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-destructive">${Number(c.total_cost).toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-bold ${Number(c.net_profit) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          ${Number(c.net_profit).toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right ${Number(c.margin_pct) > 20 ? 'text-primary' : Number(c.margin_pct) > 0 ? 'text-amber-600' : 'text-destructive'}`}>
                          {Number(c.margin_pct).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">{c.total_calls}</TableCell>
                        <TableCell>
                          {c.auto_paused ? (
                            <Badge variant="destructive">Auto-Paused</Badge>
                          ) : (
                            <Badge variant="outline">{c.status}</Badge>
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

        {/* Rep Efficiency */}
        <TabsContent value="reps">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rep Efficiency Ranking</CardTitle>
              <CardDescription>Score = profit/hr (50%) + connect rate (30%) + experience (20%)</CardDescription>
            </CardHeader>
            <CardContent>
              {repMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No rep data yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rep</TableHead>
                      <TableHead className="text-right">Sessions</TableHead>
                      <TableHead className="text-right">Connects</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="text-right">Profit/Hr</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...repMetrics].sort((a: any, b: any) => Number(b.profit_per_hour) - Number(a.profit_per_hour)).map((rep: any, i: number) => (
                      <TableRow key={rep.rep_user_id}>
                        <TableCell className="font-medium">
                          {i === 0 && <Star className="h-3 w-3 inline mr-1 text-amber-500" />}
                          {rep.rep_user_id?.substring(0, 8)}…
                        </TableCell>
                        <TableCell className="text-right">{rep.total_sessions}</TableCell>
                        <TableCell className="text-right">{rep.total_connects}</TableCell>
                        <TableCell className="text-right text-primary">${Number(rep.total_revenue).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-destructive">${Number(rep.total_cost).toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-bold ${Number(rep.net_profit) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          ${Number(rep.net_profit).toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${Number(rep.profit_per_hour) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          ${Number(rep.profit_per_hour).toFixed(2)}
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
