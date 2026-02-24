import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DollarSign, TrendingUp, TrendingDown, Shield, AlertTriangle,
  BarChart3, Phone, Clock, Zap, Activity, Save, Users, FileText
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

export default function DialerCostDashboard() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  // Global limits
  const { data: limits } = useQuery({
    queryKey: ['dialer-global-limits', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_global_limits')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  // Today's cost events
  const { data: todayCosts = [] } = useQuery({
    queryKey: ['today-cost-events', currentBusiness?.id],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('call_cost_events')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 10000,
  });

  // Campaign margin view
  const { data: campaignMargins = [] } = useQuery({
    queryKey: ['campaign-margins', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_campaign_margin' as any)
        .select('*')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 15000,
  });

  // Rep profit metrics
  const { data: repMetrics = [] } = useQuery({
    queryKey: ['rep-profit-metrics', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_rep_profit_metrics' as any)
        .select('*')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 15000,
  });

  // Compliance events
  const { data: complianceEvents = [] } = useQuery({
    queryKey: ['compliance-events', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('compliance_events')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Opt-out events
  const { data: optOutEvents = [] } = useQuery({
    queryKey: ['opt-out-events', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_opt_out_events')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Daily metrics history
  const { data: dailyMetrics = [] } = useQuery({
    queryKey: ['dialer-daily-metrics', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dialer_daily_metrics')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .order('metric_date', { ascending: false })
        .limit(14);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Limits form
  const [limitsForm, setLimitsForm] = useState({
    max_daily_calls: limits?.max_daily_calls ?? 500,
    max_daily_cost: Number(limits?.max_daily_cost) || 50,
    max_hourly_calls: limits?.max_hourly_calls ?? 100,
    auto_pause_on_limit: limits?.auto_pause_on_limit ?? true,
  });

  const saveLimits = useMutation({
    mutationFn: async () => {
      if (!currentBusiness?.id) return;
      const { error } = await supabase
        .from('dialer_global_limits')
        .upsert({
          business_id: currentBusiness.id,
          ...limitsForm,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'business_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Global limits saved');
      queryClient.invalidateQueries({ queryKey: ['dialer-global-limits'] });
    },
    onError: (e: any) => toast.error(`Failed: ${e.message}`),
  });

  // Computed metrics
  const todayTotalCost = todayCosts.reduce((s, e) => s + (Number((e as any).estimated_cost) || 0), 0);
  const todayTotalCalls = todayCosts.length;
  const todayTotalMinutes = todayCosts.reduce((s, e) => s + (Number((e as any).billable_minutes) || 0), 0);
  const avgCostPerCall = todayTotalCalls > 0 ? todayTotalCost / todayTotalCalls : 0;

  const dailyCallPct = limits?.max_daily_calls ? (todayTotalCalls / limits.max_daily_calls) * 100 : 0;
  const dailyCostPct = limits?.max_daily_cost ? (todayTotalCost / Number(limits.max_daily_cost)) * 100 : 0;

  const isPaused = !!limits?.paused_at;

  // Today's compliance counts
  const todayDncCount = complianceEvents.filter(e => {
    const d = new Date(e.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString() && e.event_type === 'dnc_applied';
  }).length;

  return (
    <div className="w-full min-h-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6" /> Cost Control, Compliance & Profit Intelligence
        </h2>
        <p className="text-muted-foreground">Real-time costs, kill switches, compliance tracking, rep profit, and campaign margin</p>
      </div>

      {/* Pause Alert */}
      {isPaused && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">ENGINE AUTO-PAUSED</p>
              <p className="text-xs text-destructive/80">Reason: {limits?.paused_reason}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={async () => {
            await supabase.from('dialer_global_limits').update({
              paused_at: null, paused_reason: null, updated_at: new Date().toISOString(),
            }).eq('business_id', currentBusiness?.id);
            queryClient.invalidateQueries({ queryKey: ['dialer-global-limits'] });
            toast.success('Engine unpaused');
          }}>
            Resume Engine
          </Button>
        </div>
      )}

      {/* Today's Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">${todayTotalCost.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Today's Cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Phone className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{todayTotalCalls}</p>
            <p className="text-xs text-muted-foreground">Today's Calls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{todayTotalMinutes}</p>
            <p className="text-xs text-muted-foreground">Total Minutes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Activity className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">${avgCostPerCall.toFixed(4)}</p>
            <p className="text-xs text-muted-foreground">Avg Cost/Call</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Shield className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className="text-2xl font-bold">{todayDncCount}</p>
            <p className="text-xs text-muted-foreground">New DNCs Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Limit Progress */}
      {limits && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" /> Daily Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Calls: {todayTotalCalls} / {limits.max_daily_calls}</span>
                <span className={dailyCallPct > 80 ? 'text-destructive font-semibold' : ''}>{dailyCallPct.toFixed(0)}%</span>
              </div>
              <Progress value={Math.min(dailyCallPct, 100)} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Cost: ${todayTotalCost.toFixed(2)} / ${Number(limits.max_daily_cost).toFixed(2)}</span>
                <span className={dailyCostPct > 80 ? 'text-destructive font-semibold' : ''}>{dailyCostPct.toFixed(0)}%</span>
              </div>
              <Progress value={Math.min(dailyCostPct, 100)} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Cost | Compliance | Rep Profit | Campaign Margin | History */}
      <Tabs defaultValue="cost" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="cost" className="gap-1"><DollarSign className="h-3 w-3" /> Cost Monitor</TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1"><Shield className="h-3 w-3" /> Compliance</TabsTrigger>
          <TabsTrigger value="rep-profit" className="gap-1"><Users className="h-3 w-3" /> Rep Profit</TabsTrigger>
          <TabsTrigger value="campaign" className="gap-1"><BarChart3 className="h-3 w-3" /> Campaign Margin</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><FileText className="h-3 w-3" /> Daily History</TabsTrigger>
        </TabsList>

        {/* ── Cost Monitor ── */}
        <TabsContent value="cost">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" /> Global Rate Limits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Max Daily Calls</Label>
                    <Input type="number" value={limitsForm.max_daily_calls} onChange={e => setLimitsForm(f => ({ ...f, max_daily_calls: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Max Daily Cost ($)</Label>
                    <Input type="number" step="0.01" value={limitsForm.max_daily_cost} onChange={e => setLimitsForm(f => ({ ...f, max_daily_cost: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Max Hourly Calls</Label>
                    <Input type="number" value={limitsForm.max_hourly_calls} onChange={e => setLimitsForm(f => ({ ...f, max_hourly_calls: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch checked={limitsForm.auto_pause_on_limit} onCheckedChange={c => setLimitsForm(f => ({ ...f, auto_pause_on_limit: c }))} />
                    <Label className="text-xs">Auto-pause on limit</Label>
                  </div>
                </div>
                <Button onClick={() => saveLimits.mutate()} disabled={saveLimits.isPending} className="w-full gap-2">
                  <Save className="h-4 w-4" /> Save Limits
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Opt-Out / DNC Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {optOutEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No opt-out events recorded</p>
                ) : (
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-2">
                      {optOutEvents.map((evt: any) => (
                        <div key={evt.id} className="flex items-center justify-between p-2 border rounded-lg text-xs">
                          <div>
                            <p className="font-medium">{evt.phone_number || 'Unknown'}</p>
                            <p className="text-muted-foreground">{evt.reason || 'No reason'} • {evt.method}</p>
                          </div>
                          <span className="text-muted-foreground">{new Date(evt.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Compliance Panel ── */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" /> Compliance Event Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {complianceEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No compliance events recorded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complianceEvents.map((evt) => (
                      <TableRow key={evt.id}>
                        <TableCell>
                          <Badge variant={evt.event_type === 'dnc_applied' ? 'destructive' : evt.event_type === 'opt_out' ? 'secondary' : 'outline'}>
                            {evt.event_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{evt.source || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{evt.notes || '—'}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{new Date(evt.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Rep Profit ── */}
        <TabsContent value="rep-profit">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" /> Rep Profit Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {repMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No rep profit data yet — profits populate after calls with revenue attribution</p>
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
                      <TableHead className="text-right">Talk Hours</TableHead>
                      <TableHead className="text-right">Profit/Hr</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repMetrics.map((rep: any) => {
                      const profitColor = Number(rep.net_profit) >= 0 ? 'text-primary' : 'text-destructive';
                      return (
                        <TableRow key={rep.rep_user_id}>
                          <TableCell className="font-medium text-sm">{rep.rep_user_id?.substring(0, 8)}…</TableCell>
                          <TableCell className="text-right">{rep.total_sessions}</TableCell>
                          <TableCell className="text-right">{rep.total_connects}</TableCell>
                          <TableCell className="text-right text-primary">${Number(rep.total_revenue).toFixed(2)}</TableCell>
                          <TableCell className="text-right text-destructive">${Number(rep.total_cost).toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-bold ${profitColor}`}>${Number(rep.net_profit).toFixed(2)}</TableCell>
                          <TableCell className="text-right">{(Number(rep.total_talk_seconds) / 3600).toFixed(1)}</TableCell>
                          <TableCell className={`text-right font-semibold ${profitColor}`}>${Number(rep.profit_per_hour).toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Campaign Margin ── */}
        <TabsContent value="campaign">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Campaign Margin Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaignMargins.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No campaign cost data yet — costs populate after live calls complete</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="text-right">Rev/Dial</TableHead>
                      <TableHead className="text-right">Cost/Dial</TableHead>
                      <TableHead className="text-right">Profit/Dial</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignMargins.map((cm: any) => {
                      const marginColor = cm.margin_pct > 20 ? 'text-primary' : cm.margin_pct > 0 ? 'text-amber-600' : 'text-destructive';
                      return (
                        <TableRow key={cm.campaign_id}>
                          <TableCell className="font-medium">{cm.campaign_name}</TableCell>
                          <TableCell className="text-right text-primary">${Number(cm.revenue).toFixed(2)}</TableCell>
                          <TableCell className="text-right text-destructive">${Number(cm.total_cost).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            <span className={Number(cm.net_profit) >= 0 ? 'text-primary' : 'text-destructive'}>
                              ${Number(cm.net_profit).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className={`text-right font-bold ${marginColor}`}>{Number(cm.margin_pct).toFixed(1)}%</TableCell>
                          <TableCell className="text-right">${Number(cm.revenue_per_dial).toFixed(3)}</TableCell>
                          <TableCell className="text-right">${Number(cm.cost_per_dial).toFixed(4)}</TableCell>
                          <TableCell className="text-right">${Number(cm.profit_per_dial).toFixed(3)}</TableCell>
                          <TableCell className="text-right">{cm.total_calls}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Daily History ── */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" /> Daily Metrics History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No daily summaries yet — run the nightly summary to populate</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Dials</TableHead>
                      <TableHead className="text-right">Connects</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="text-right">DNCs</TableHead>
                      <TableHead className="text-right">Avg Answer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyMetrics.map((day: any) => (
                      <TableRow key={day.id}>
                        <TableCell className="font-medium">{day.metric_date}</TableCell>
                        <TableCell className="text-right">{day.total_dials}</TableCell>
                        <TableCell className="text-right">{day.total_connects}</TableCell>
                        <TableCell className="text-right text-primary">${Number(day.total_revenue).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-destructive">${Number(day.total_cost).toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-bold ${Number(day.net_profit) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          ${Number(day.net_profit).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">{day.new_dnc_count}</TableCell>
                        <TableCell className="text-right">{(Number(day.avg_answer_rate) * 100).toFixed(1)}%</TableCell>
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
