import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, Clock, Zap, BarChart3,
  ChevronRight, RefreshCw, ShieldAlert, TrendingUp, TrendingDown, Target, DollarSign,
  Shield, Lock, Bug
} from 'lucide-react';
import { format, subHours, differenceInMilliseconds } from 'date-fns';
import { useBusiness } from '@/contexts/BusinessContext';

type StepRow = {
  id: string;
  run_id: string;
  step_name: string;
  rpc_name: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number;
  rows_affected: number;
  error_code: string | null;
  error_message: string | null;
  output_json: any;
};

type DeltaRow = {
  id: string;
  run_id: string;
  queue_priority_rows_changed: number;
  queue_priority_avg_delta: number;
  queue_priority_max_delta: number;
  campaign_weights_changed: number;
  campaign_weight_avg_delta: number;
  inventory_seed_inserted: number;
  inventory_seed_updated: number;
  inventory_seed_blocked: number;
  agent_routing_top_rep_share: number;
  agent_routing_gini: number | null;
  notes: any;
};

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle }> = {
  ok: { color: 'bg-green-500/15 text-green-400 border-green-500/30', icon: CheckCircle },
  warn: { color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: AlertTriangle },
  error: { color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: XCircle },
  skipped: { color: 'bg-muted text-muted-foreground border-border', icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.skipped;
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {status.toUpperCase()}
    </Badge>
  );
}

function generateAlerts(runs: any[], allSteps: StepRow[]): { level: 'critical' | 'warning'; message: string }[] {
  const alerts: { level: 'critical' | 'warning'; message: string }[] = [];
  if (!runs.length) return alerts;
  const stepsByRpc = new Map<string, StepRow[]>();
  allSteps.forEach(s => {
    const arr = stepsByRpc.get(s.rpc_name) || [];
    arr.push(s);
    stepsByRpc.set(s.rpc_name, arr);
  });
  const rpcs = [
    'calculate_predictive_profit_score',
    'auto_adjust_campaign_weights',
    'get_best_rep_for_store',
    'boost_queue_priority_for_hour',
    'seed_outbound_queue_from_inventory',
    'claim_available_agent',
  ];
  rpcs.forEach(rpc => {
    const steps = stepsByRpc.get(rpc) || [];
    if (!steps.length) {
      alerts.push({ level: 'warning', message: `"${rpc}" never executed in the visible window.` });
      return;
    }
    const sorted = [...steps].sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
    let consecutiveFails = 0;
    for (const s of sorted) {
      if (s.status === 'error') consecutiveFails++;
      else break;
    }
    if (consecutiveFails >= 2) {
      alerts.push({ level: 'critical', message: `"${rpc}" failed ${consecutiveFails} consecutive runs.` });
    }
    const last10 = sorted.slice(0, 10);
    const allZero = last10.length >= 5 && last10.every(s => s.rows_affected === 0 && s.status !== 'error');
    if (allZero) {
      alerts.push({ level: 'warning', message: `"${rpc}" executed ${last10.length} times with 0 impact — decorative intelligence.` });
    }
  });
  return alerts;
}

export default function DialerIntegrityPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDebug, setShowDebug] = useState(false);
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const bizId = currentBusiness?.id;

  // ─── Truth View: latest run per business ───
  const { data: latestRun } = useQuery({
    queryKey: ['v-dialer-latest-run', bizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_dialer_latest_run' as any)
        .select('*')
        .eq('business_id', bizId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!bizId,
  });

  // ─── Dialer Settings (for target mode status) ───
  const { data: dialerSettings } = useQuery({
    queryKey: ['dialer-settings-integrity', bizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_settings')
        .select('target_mode_enabled, target_profit_7d')
        .eq('business_id', bizId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!bizId,
  });

  // ─── All runs (24h) for timeline ───
  const { data: runs = [], isLoading: runsLoading, refetch } = useQuery({
    queryKey: ['integrity-runs', bizId],
    queryFn: async () => {
      const since = subHours(new Date(), 24).toISOString();
      const { data, error } = await supabase
        .from('dialer_intelligence_runs')
        .select('*')
        .eq('business_id', bizId)
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!bizId,
  });

  // Forecast trend from runs
  const forecastTrend = runs
    .filter((r: any) => r.projected_profit != null)
    .slice(0, 30)
    .reverse();

  const { data: allSteps = [] } = useQuery({
    queryKey: ['integrity-all-steps', runs.map(r => r.id).join(',')],
    queryFn: async () => {
      if (!runs.length) return [];
      const runIds = runs.map(r => r.id);
      const { data, error } = await supabase
        .from('dialer_intelligence_run_steps')
        .select('*')
        .in('run_id', runIds)
        .order('started_at', { ascending: true });
      if (error) throw error;
      return (data || []) as StepRow[];
    },
    enabled: runs.length > 0,
  });

  const { data: selectedSteps = [] } = useQuery({
    queryKey: ['integrity-steps', selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const { data, error } = await supabase
        .from('dialer_intelligence_run_steps')
        .select('*')
        .eq('run_id', selectedRunId)
        .order('started_at', { ascending: true });
      if (error) throw error;
      return (data || []) as StepRow[];
    },
    enabled: !!selectedRunId,
  });

  const { data: selectedDelta } = useQuery({
    queryKey: ['integrity-delta', selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return null;
      const { data, error } = await supabase
        .from('dialer_intelligence_deltas')
        .select('*')
        .eq('run_id', selectedRunId)
        .maybeSingle();
      if (error) throw error;
      return data as DeltaRow | null;
    },
    enabled: !!selectedRunId,
  });

  // KPIs
  const totalRuns = runs.length;
  const okRuns = runs.filter(r => r.overall_status === 'ok').length;
  const warnRuns = runs.filter(r => r.overall_status === 'warn').length;
  const errorRuns = runs.filter(r => r.overall_status === 'error').length;
  const avgDuration = totalRuns > 0
    ? Math.round(runs.reduce((sum, r) => {
        if (!r.ended_at) return sum;
        return sum + differenceInMilliseconds(new Date(r.ended_at), new Date(r.started_at));
      }, 0) / totalRuns)
    : 0;
  const totalRowsChanged = allSteps.reduce((s, st) => s + (st.rows_affected || 0), 0);
  const alerts = generateAlerts(runs, allSteps);
  const filteredRuns = statusFilter === 'all' ? runs : runs.filter(r => r.overall_status === statusFilter);

  const targetEnabled = dialerSettings?.target_mode_enabled ?? false;
  const targetProfit = dialerSettings?.target_profit_7d ?? null;

  const kpis = [
    { label: 'Total Runs (24h)', value: totalRuns, icon: Activity, accent: 'text-blue-400' },
    { label: '% OK', value: totalRuns ? `${Math.round((okRuns / totalRuns) * 100)}%` : '—', icon: CheckCircle, accent: 'text-green-400' },
    { label: '% WARN', value: totalRuns ? `${Math.round((warnRuns / totalRuns) * 100)}%` : '—', icon: AlertTriangle, accent: 'text-yellow-400' },
    { label: '% ERROR', value: totalRuns ? `${Math.round((errorRuns / totalRuns) * 100)}%` : '—', icon: XCircle, accent: 'text-red-400' },
    { label: 'Avg Duration', value: `${avgDuration}ms`, icon: Clock, accent: 'text-purple-400' },
    { label: 'Total Rows Changed', value: totalRowsChanged, icon: Zap, accent: 'text-cyan-400' },
  ];

  // Helpers for safe number display
  const num = (v: any, decimals = 0) => v != null ? Number(v).toFixed(decimals) : '—';
  const pct = (v: any) => v != null ? `${(Number(v) * 100).toFixed(0)}%` : '—';

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Dialer Intelligence Integrity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Proof the machine is thinking — not wearing a costume.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className="gap-1">
            <Bug className="h-4 w-4" /> Debug
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['v-dialer-latest-run'] });
          }} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <Alert key={i} variant={a.level === 'critical' ? 'destructive' : 'default'} className="border">
              {a.level === 'critical' ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <AlertTitle>{a.level === 'critical' ? 'Critical Alert' : 'Warning'}</AlertTitle>
              <AlertDescription>{a.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <k.icon className={`h-5 w-5 mb-1 ${k.accent}`} />
              <span className="text-2xl font-bold">{k.value}</span>
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══════ FORECAST PANEL (ALWAYS VISIBLE) ═══════ */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            7-Day Revenue Forecast
            {latestRun?.started_at && (
              <Badge variant="outline" className="ml-auto text-xs">
                {format(new Date(latestRun.started_at), 'MMM d, yyyy HH:mm')}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!latestRun ? (
            <p className="text-sm text-muted-foreground">No forecast yet — run the engine once to generate projections.</p>
          ) : latestRun.projected_profit == null ? (
            <p className="text-sm text-muted-foreground">Engine ran but no forecast data was produced. Check engine logs.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Projected Profit', value: `$${num(latestRun.projected_profit)}`, icon: DollarSign, accent: Number(latestRun.projected_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400' },
                  { label: 'Projected Revenue', value: `$${num(latestRun.projected_revenue)}`, icon: TrendingUp, accent: 'text-blue-400' },
                  { label: 'Projected Cost', value: `$${num(latestRun.projected_cost)}`, icon: TrendingDown, accent: 'text-orange-400' },
                  { label: 'Projected Attempts', value: num(latestRun.projected_attempts), icon: Activity, accent: 'text-cyan-400' },
                  { label: 'Projected Connects', value: num(latestRun.projected_connects), icon: Zap, accent: 'text-purple-400' },
                ].map(m => (
                  <Card key={m.label} className="border-border/50">
                    <CardContent className="p-3 flex flex-col items-center text-center">
                      <m.icon className={`h-4 w-4 mb-1 ${m.accent}`} />
                      <span className="text-lg font-bold">{m.value}</span>
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Confidence meter */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Forecast Confidence</span>
                  <span className="font-mono font-semibold">{pct(latestRun.forecast_confidence)}</span>
                </div>
                <Progress value={Number(latestRun.forecast_confidence || 0) * 100} className="h-2" />
              </div>

              {/* Forecast Inputs */}
              {latestRun.forecast_inputs && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Forecast Inputs</summary>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(latestRun.forecast_inputs as Record<string, any>).map(([k, v]) => (
                      <div key={k} className="bg-muted p-2 rounded">
                        <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                        <p className="font-mono font-semibold">{typeof v === 'number' ? v.toFixed(4) : String(v)}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          {/* ─── Target Mode Status (ALWAYS VISIBLE) ─── */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/50">
            <Target className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Target Mode</span>
                {!targetEnabled ? (
                  <Badge variant="outline" className="text-xs">Off</Badge>
                ) : !latestRun?.target_mode_action ? (
                  <Badge variant="outline" className="text-xs">Waiting for first run</Badge>
                ) : (
                  <Badge variant={
                    String(latestRun.target_mode_action).includes('acceleration') ? 'destructive' :
                    String(latestRun.target_mode_action).includes('stabilization') ? 'secondary' :
                    'outline'
                  } className="text-xs">
                    {String(latestRun.target_mode_action).includes('acceleration') ? 'Accelerating' :
                     String(latestRun.target_mode_action).includes('stabilization') ? 'Stabilizing' :
                     'On Track'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {targetEnabled
                  ? `Target: $${num(targetProfit)} · Gap: $${num(latestRun?.target_gap)} · ${latestRun?.target_mode_action || 'pending'}`
                  : 'Enable in Dialer Settings to set a 7-day profit target.'}
              </p>
            </div>
          </div>

          {/* Trend warning */}
          {forecastTrend.length >= 5 && (() => {
            const recent5 = forecastTrend.slice(-5);
            const profitTrend = recent5.map((r: any) => Number(r.projected_profit || 0));
            const isDecline = profitTrend.every((v: number, i: number) => i === 0 || v <= profitTrend[i - 1]);
            const impactTrend = recent5.map((r: any) => Number(r.impact_score || 0));
            const impactUp = impactTrend.every((v: number, i: number) => i === 0 || v >= impactTrend[i - 1]);
            if (isDecline && impactUp) {
              return (
                <Alert variant="destructive" className="border">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Trajectory Warning</AlertTitle>
                  <AlertDescription>
                    Short-term optimization may be masking long-term decline — projected profit is trending down while impact scores are trending up.
                  </AlertDescription>
                </Alert>
              );
            }
            return null;
          })()}
        </CardContent>
      </Card>

      {/* ═══════ STABILITY GUARD PANEL (ALWAYS VISIBLE) ═══════ */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Stability Guard
            {latestRun?.adaptive_locked && (
              <Badge variant="destructive" className="text-xs gap-1 ml-2">
                <Lock className="h-3 w-3" /> Cooldown Locked
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!latestRun ? (
            <p className="text-sm text-muted-foreground">No stability data yet — run the engine to populate.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Adaptive Mode', value: latestRun.adaptive_mode || '—' },
                { label: 'Multiplier', value: num(latestRun.adaptive_multiplier, 2) },
                { label: 'Refresh Interval', value: latestRun.effective_refresh_interval ? `${num(latestRun.effective_refresh_interval)}s` : '—' },
                { label: 'Impact Score', value: num(latestRun.impact_score, 1) },
                { label: 'Rolling Avg Impact', value: num(latestRun.rolling_avg_impact, 2) },
                { label: 'Negative Ratio', value: pct(latestRun.rolling_negative_ratio) },
                { label: 'Cooldown Locked', value: latestRun.adaptive_locked ? `Yes (${latestRun.adaptive_lock_cycles_remaining} left)` : 'No' },
                { label: 'Stability Notes', value: latestRun.stability_notes || 'None' },
              ].map(d => (
                <Card key={d.label} className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-sm font-bold truncate" title={String(d.value)}>{d.value}</p>
                    <p className="text-xs text-muted-foreground">{d.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ DEBUG PANEL (ADMIN ONLY) ═══════ */}
      {showDebug && latestRun && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="h-4 w-4 text-yellow-500" /> Debug: Raw Values from v_dialer_latest_run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              {[
                ['business_id', latestRun.business_id],
                ['run_id', latestRun.run_id],
                ['started_at', latestRun.started_at],
                ['overall_status', latestRun.overall_status],
                ['impact_score', latestRun.impact_score],
                ['projected_profit', latestRun.projected_profit],
                ['projected_revenue', latestRun.projected_revenue],
                ['forecast_confidence', latestRun.forecast_confidence],
                ['target_gap', latestRun.target_gap],
                ['target_mode_action', latestRun.target_mode_action],
                ['adaptive_mode', latestRun.adaptive_mode],
                ['adaptive_multiplier', latestRun.adaptive_multiplier],
                ['adaptive_locked', String(latestRun.adaptive_locked)],
                ['lock_cycles_remaining', latestRun.adaptive_lock_cycles_remaining],
                ['stability_notes', latestRun.stability_notes],
                ['settings.target_enabled', String(targetEnabled)],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-muted p-2 rounded overflow-hidden">
                  <span className="text-muted-foreground block truncate">{k}</span>
                  <span className="text-foreground block truncate" title={String(v ?? 'null')}>{v ?? 'null'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'ok', 'warn', 'error'].map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : s.toUpperCase()}
          </Button>
        ))}
      </div>

      {/* Run Timeline Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Run Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runsLoading ? (
            <p className="p-6 text-muted-foreground text-sm">Loading runs…</p>
          ) : filteredRuns.length === 0 ? (
            <p className="p-6 text-muted-foreground text-sm">No intelligence runs recorded in the last 24 hours.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Impact</TableHead>
                  <TableHead className="text-right">Steps</TableHead>
                  <TableHead className="text-right">Rows Changed</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.map(run => {
                  const runSteps = allSteps.filter(s => s.run_id === run.id);
                  const rowsChanged = runSteps.reduce((s, st) => s + (st.rows_affected || 0), 0);
                  const dur = run.ended_at
                    ? differenceInMilliseconds(new Date(run.ended_at), new Date(run.started_at))
                    : null;
                  return (
                    <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRunId(run.id)}>
                      <TableCell className="text-xs font-mono">
                        {format(new Date(run.started_at), 'MMM d, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell><StatusBadge status={run.overall_status} /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{run.run_mode}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {run.impact_score != null ? Number(run.impact_score).toFixed(1) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{runSteps.length}</TableCell>
                      <TableCell className="text-right font-mono">{rowsChanged}</TableCell>
                      <TableCell className="text-right text-xs">{dur !== null ? `${dur}ms` : '—'}</TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Drawer open={!!selectedRunId} onOpenChange={(o) => !o && setSelectedRunId(null)}>
        <DrawerContent className="max-h-[85vh] overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Run Detail</DrawerTitle>
            <DrawerDescription>
              {selectedRunId ? `Run ID: ${selectedRunId.slice(0, 8)}…` : ''}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-6">
            {/* Steps */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Step Execution
              </h3>
              {selectedSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No steps recorded.</p>
              ) : (
                <div className="space-y-2">
                  {selectedSteps.map(step => (
                    <Card key={step.id} className="border-border/50">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-medium">{step.rpc_name}</span>
                          <StatusBadge status={step.status} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <span>Duration: <strong className="text-foreground">{step.duration_ms}ms</strong></span>
                          <span>Rows: <strong className="text-foreground">{step.rows_affected}</strong></span>
                          <span>Step: <strong className="text-foreground">{step.step_name}</strong></span>
                        </div>
                        {step.error_message && (
                          <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded font-mono">{step.error_message}</p>
                        )}
                        {step.output_json && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Output JSON</summary>
                            <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-40 text-xs">
                              {JSON.stringify(step.output_json, null, 2)}
                            </pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Delta Summary */}
            {selectedDelta && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Delta Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Queue Rows Changed', value: selectedDelta.queue_priority_rows_changed },
                    { label: 'Avg Priority Δ', value: Number(selectedDelta.queue_priority_avg_delta).toFixed(2) },
                    { label: 'Max Priority Δ', value: Number(selectedDelta.queue_priority_max_delta).toFixed(2) },
                    { label: 'Campaign Weights Changed', value: selectedDelta.campaign_weights_changed },
                    { label: 'Avg Weight Δ', value: Number(selectedDelta.campaign_weight_avg_delta).toFixed(3) },
                    { label: 'Inventory Inserted', value: selectedDelta.inventory_seed_inserted },
                    { label: 'Inventory Updated', value: selectedDelta.inventory_seed_updated },
                    { label: 'Inventory Blocked', value: selectedDelta.inventory_seed_blocked },
                    { label: 'Top Rep Share', value: `${(Number(selectedDelta.agent_routing_top_rep_share) * 100).toFixed(1)}%` },
                  ].map(d => (
                    <Card key={d.label} className="border-border/50">
                      <CardContent className="p-3 text-center">
                        <p className="text-lg font-bold">{d.value}</p>
                        <p className="text-xs text-muted-foreground">{d.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Integrity Warnings for this run */}
            {selectedSteps.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Integrity Warnings
                </h3>
                <div className="space-y-1">
                  {selectedSteps
                    .filter(s => s.status === 'ok' && s.rows_affected === 0)
                    .map(s => (
                      <p key={s.id} className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
                        ⚠ "{s.rpc_name}" executed successfully but 0 rows changed — decorative.
                      </p>
                    ))}
                  {selectedSteps
                    .filter(s => s.status === 'error')
                    .map(s => (
                      <p key={s.id} className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                        🛑 "{s.rpc_name}" failed: {s.error_message || 'unknown error'}
                      </p>
                    ))}
                  {selectedSteps
                    .filter(s => s.status === 'skipped')
                    .map(s => (
                      <p key={s.id} className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        ⏭ "{s.rpc_name}" was skipped.
                      </p>
                    ))}
                  {selectedSteps.every(s => s.status === 'ok' && s.rows_affected > 0) && (
                    <p className="text-xs text-green-400 bg-green-500/10 p-2 rounded">
                      ✅ All RPCs executed with measurable impact.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
