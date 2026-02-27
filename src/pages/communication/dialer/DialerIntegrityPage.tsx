import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, Clock, Zap, BarChart3,
  ChevronRight, RefreshCw, ShieldAlert, TrendingUp, TrendingDown
} from 'lucide-react';
import { format, subHours, differenceInMilliseconds } from 'date-fns';

type RunRow = {
  id: string;
  business_id: string;
  engine_cycle_id: string | null;
  started_at: string;
  ended_at: string | null;
  run_mode: string;
  overall_status: string;
  notes: string | null;
};

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

function generateAlerts(runs: RunRow[], allSteps: StepRow[]): { level: 'critical' | 'warning'; message: string }[] {
  const alerts: { level: 'critical' | 'warning'; message: string }[] = [];
  if (!runs.length) return alerts;

  // Group steps by rpc_name
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
    // consecutive failures
    const sorted = [...steps].sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
    let consecutiveFails = 0;
    for (const s of sorted) {
      if (s.status === 'error') consecutiveFails++;
      else break;
    }
    if (consecutiveFails >= 2) {
      alerts.push({ level: 'critical', message: `"${rpc}" failed ${consecutiveFails} consecutive runs.` });
    }
    // decorative intelligence
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

  const { data: runs = [], isLoading: runsLoading, refetch } = useQuery({
    queryKey: ['integrity-runs'],
    queryFn: async () => {
      const since = subHours(new Date(), 24).toISOString();
      const { data, error } = await supabase
        .from('dialer_intelligence_runs')
        .select('*')
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as RunRow[];
    },
  });

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

  const kpis = [
    { label: 'Total Runs (24h)', value: totalRuns, icon: Activity, accent: 'text-blue-400' },
    { label: '% OK', value: totalRuns ? `${Math.round((okRuns / totalRuns) * 100)}%` : '—', icon: CheckCircle, accent: 'text-green-400' },
    { label: '% WARN', value: totalRuns ? `${Math.round((warnRuns / totalRuns) * 100)}%` : '—', icon: AlertTriangle, accent: 'text-yellow-400' },
    { label: '% ERROR', value: totalRuns ? `${Math.round((errorRuns / totalRuns) * 100)}%` : '—', icon: XCircle, accent: 'text-red-400' },
    { label: 'Avg Duration', value: `${avgDuration}ms`, icon: Clock, accent: 'text-purple-400' },
    { label: 'Total Rows Changed', value: totalRowsChanged, icon: Zap, accent: 'text-cyan-400' },
  ];

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
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
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
                        {format(new Date(run.started_at), 'MMM d HH:mm:ss')}
                      </TableCell>
                      <TableCell><StatusBadge status={run.overall_status} /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{run.run_mode}</Badge>
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
