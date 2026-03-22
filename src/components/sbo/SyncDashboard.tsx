import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Loader2, RefreshCw, CheckCircle, XCircle, Database,
  Zap, Clock, DollarSign, Play, AlertTriangle,
  Calendar, TrendingUp, Activity
} from 'lucide-react';
import { toast } from 'sonner';

const API_COST_INFO: Record<string, {
  label: string; color: string; bgColor: string; borderColor: string;
  freeLimit: number | null; unit: string; costPerUnit: string; notes: string;
}> = {
  the_odds_api: {
    label: 'The Odds API',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    freeLimit: 500,
    unit: 'requests/month',
    costPerUnit: '$0 (free tier)',
    notes: 'Free tier: 500 requests/month. Paid: ~$0.001/request at $50/mo plan.',
  },
  sportsdata_io: {
    label: 'SportsDataIO',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    freeLimit: null,
    unit: 'subscription',
    costPerUnit: 'Flat monthly rate',
    notes: 'Subscription plan — unlimited calls included. No per-call cost.',
  },
  prizepicks: {
    label: 'PrizePicks',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    freeLimit: null,
    unit: 'always free',
    costPerUnit: '$0',
    notes: 'Unofficial public API — always free. No rate limits documented.',
  },
  polymarket: {
    label: 'Polymarket',
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    freeLimit: null,
    unit: 'always free',
    costPerUnit: '$0',
    notes: 'Public prediction market API — free, no key needed. Real money consensus odds.',
  },
  internal: {
    label: 'Internal',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    freeLimit: null,
    unit: 'internal',
    costPerUnit: '$0',
    notes: 'Internal computation — compares data already in your database. No external API calls.',
  },
};

const DAY_ENGINE_STEPS = {
  morning: [
    { fn: 'sbo-sync-daily', label: 'Season Stats + Injuries + Standings', icon: '📊', provider: 'sportsdata_io', cost: '$0 (subscription)', when: '8:00 AM' },
  ],
  pregame: [
    { fn: 'sbo-fetch-odds', label: 'Live Odds — DK / FanDuel / BetMGM / Caesars', icon: '💰', provider: 'the_odds_api', cost: '1 request', when: '6:00 PM' },
    { fn: 'sbo-sync-pregame', label: 'Projections + Game Logs + SDIO Props', icon: '📈', provider: 'sportsdata_io', cost: '$0 (subscription)', when: '6:00 PM' },
    { fn: 'sbo-sync-prizepicks', label: 'PrizePicks Props', icon: '🎯', provider: 'prizepicks', cost: '$0 (free)', when: '6:00 PM' },
    { fn: 'sbo-sync-polymarket-full', label: 'Polymarket Full Sync', icon: '🔮', provider: 'polymarket', cost: '$0 (free)', when: '6:00 PM' },
    { fn: 'sbo-compare-odds', label: 'Odds Comparison Engine', icon: '💎', provider: 'internal', cost: '$0', when: '6:05 PM' },
  ],
  postgame: [
    { fn: 'sbo-track-results', label: 'Grade Predictions + Update Accuracy', icon: '📋', provider: 'sportsdata_io', cost: '$0 (subscription)', when: '11:00 PM' },
  ],
};

const ALL_STEPS = [...DAY_ENGINE_STEPS.morning, ...DAY_ENGINE_STEPS.pregame, ...DAY_ENGINE_STEPS.postgame];

// ─── SCHEDULE STATUS ──────────────────────────────────────────────────────
function ScheduleStatus() {
  const { data: scheduleInfo } = useQuery({
    queryKey: ['cron-schedule-status'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_day_engine_runs')
        .select('*')
        .eq('run_type', 'scheduled')
        .order('started_at', { ascending: false })
        .limit(6);
      return data || [];
    },
    refetchInterval: 60000,
  });

  const schedules = [
    { name: 'Morning Sync', time: '8:00 AM ET', cron: '0 13 * * *', steps: 'morning' },
    { name: 'Pre-Game Sync', time: '6:00 PM ET', cron: '0 23 * * *', steps: 'pregame' },
    { name: 'Result Tracking', time: '11:00 PM ET', cron: '0 4 * * *', steps: 'results' },
  ];

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          Auto-Schedule (pg_cron)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <p className="text-[10px] text-muted-foreground">
          These jobs run automatically every day via pg_cron.
          No action needed — but you can trigger them manually above.
        </p>
        {schedules.map(schedule => {
          const lastRun = scheduleInfo?.find((r: any) =>
            r.steps_completed?.some((s: any) => s.fn?.includes(schedule.steps))
          );
          return (
            <div key={schedule.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
              <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium">{schedule.name}</p>
                <p className="text-[9px] text-muted-foreground">
                  Daily at {schedule.time} · cron: {schedule.cron}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] text-muted-foreground">Last run</p>
                <p className="text-[10px] font-medium">
                  {lastRun
                    ? new Date(lastRun.started_at).toLocaleDateString()
                    : 'Not yet run'
                  }
                </p>
              </div>
            </div>
          );
        })}
        <div className="bg-muted/30 rounded-lg p-2 space-y-0.5">
          <p className="text-[10px] font-semibold">To activate auto-schedule:</p>
          <p className="text-[9px] text-muted-foreground">1. Enable pg_cron extension in your backend</p>
          <p className="text-[9px] text-muted-foreground">2. Run the pg_cron setup SQL</p>
          <p className="text-[9px] text-muted-foreground">3. Jobs will run automatically from that point forward</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────
export function SyncDashboard() {
  const [running, setRunning] = useState(false);
  const [runningStep, setRunningStep] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const { data: syncLogs } = useQuery({
    queryKey: ['sbo-sync-logs'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: counts } = useQuery({
    queryKey: ['sbo-table-counts'],
    queryFn: async () => {
      const tables = [
        'sbo_player_season_stats', 'sbo_player_game_logs', 'sbo_injuries',
        'sbo_player_projections', 'sbo_sdio_props', 'sbo_team_stats',
        'sbo_player_props', 'sbo_predictions', 'sbo_polymarket',
      ];
      const results: Record<string, number> = {};
      for (const table of tables) {
        const { count } = await (supabase as any)
          .from(table)
          .select('*', { count: 'exact', head: true });
        results[table] = count || 0;
      }
      return results;
    },
    refetchInterval: 30000,
  });

  const { data: monthlyCosts } = useQuery({
    queryKey: ['sbo-monthly-costs'],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { data } = await (supabase as any)
        .from('sbo_api_costs')
        .select('*')
        .gte('created_at', startOfMonth.toISOString());
      const byProvider: Record<string, { calls: number; cost: number; records: number }> = {};
      for (const row of data || []) {
        if (!byProvider[row.api_provider]) {
          byProvider[row.api_provider] = { calls: 0, cost: 0, records: 0 };
        }
        byProvider[row.api_provider].calls += row.api_calls_made || 1;
        byProvider[row.api_provider].cost += row.estimated_cost_cents || 0;
        byProvider[row.api_provider].records += row.records_returned || 0;
      }
      return byProvider;
    },
    refetchInterval: 60000,
  });

  const { data: engineRuns } = useQuery({
    queryKey: ['sbo-engine-runs'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_day_engine_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    refetchInterval: 15000,
  });

  const runDayEngine = async (steps: 'morning' | 'pregame' | 'full') => {
    setRunning(true);
    setLiveProgress([]);
    toast.info(`Starting ${steps} sync...`);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-day-engine', {
        body: { run_type: 'manual', steps, date: new Date().toISOString().split('T')[0] },
      });
      if (error) throw error;
      setLiveProgress(data.completed || []);
      if (data.status === 'completed') {
        toast.success(`✅ Sync complete — ${data.summary.total_records_synced.toLocaleString()} records in ${data.summary.duration_seconds}s`);
      } else if (data.status === 'partial') {
        toast.warning(`⚠️ Partial sync — ${data.summary.completed_steps} completed, ${data.summary.failed_steps} failed`);
      } else {
        toast.error('Sync failed — check logs below');
      }
      queryClient.invalidateQueries({ queryKey: ['sbo-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sbo-table-counts'] });
      queryClient.invalidateQueries({ queryKey: ['sbo-monthly-costs'] });
      queryClient.invalidateQueries({ queryKey: ['sbo-engine-runs'] });
    } catch (e: any) {
      toast.error(e.message || 'Day engine failed');
    } finally {
      setRunning(false);
      setRunningStep(null);
    }
  };

  const runSingleStep = async (fn: string, label: string) => {
    setRunningStep(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { date: new Date().toISOString().split('T')[0] },
      });
      if (error) throw error;
      toast.success(`${label} — complete`);
      queryClient.invalidateQueries({ queryKey: ['sbo-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sbo-table-counts'] });
      queryClient.invalidateQueries({ queryKey: ['sbo-monthly-costs'] });
    } catch (e: any) {
      toast.error(`${label} failed: ${e.message}`);
    } finally {
      setRunningStep(null);
    }
  };

  const tableLabels: Record<string, string> = {
    sbo_player_season_stats: 'Season Stats',
    sbo_player_game_logs: 'Game Logs',
    sbo_injuries: 'Injuries',
    sbo_player_projections: 'Projections',
    sbo_sdio_props: 'SDIO Props',
    sbo_team_stats: 'Team Stats',
    sbo_player_props: 'All Props',
    sbo_predictions: 'Predictions',
    sbo_polymarket: 'Polymarket',
  };

  const todayOddsApiCalls = monthlyCosts?.the_odds_api?.calls || 0;
  const oddsApiPct = Math.min((todayOddsApiCalls / 500) * 100, 100);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-primary" />
            Day Engine
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Automates all NBA data syncs — stats, odds, props, projections, results
          </p>
        </div>
        <Badge variant={running ? 'default' : 'secondary'} className="text-[10px]">
          <Activity className="w-3 h-3 mr-1" />
          {running ? 'Running...' : 'Idle'}
        </Badge>
      </div>

      {/* ONE-CLICK BUTTONS */}
      <div className="grid grid-cols-4 gap-2">
        <Button size="sm" variant="outline" onClick={() => runDayEngine('morning')} disabled={running} className="gap-1.5 flex-col h-auto py-3">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-lg">🌅</span>}
          <span className="text-[10px] font-semibold">Morning Sync</span>
          <span className="text-[9px] text-muted-foreground">Stats · Injuries</span>
        </Button>

        <Button size="sm" variant="outline" onClick={() => runDayEngine('pregame')} disabled={running} className="gap-1.5 flex-col h-auto py-3">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-lg">🏀</span>}
          <span className="text-[10px] font-semibold">Pre-Game Sync</span>
          <span className="text-[9px] text-muted-foreground">Odds · Props</span>
        </Button>

        <Button size="sm" variant="outline" onClick={() => runDayEngine('full')} disabled={running} className="gap-1.5 flex-col h-auto py-3 border-primary/40">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-primary" />}
          <span className="text-[10px] font-semibold">Full Sync</span>
          <span className="text-[9px] text-muted-foreground">All steps</span>
        </Button>

        <Button size="sm" variant="outline" onClick={() => runSingleStep('sbo-track-results', 'Result Tracking')} disabled={running || !!runningStep} className="gap-1.5 flex-col h-auto py-3">
          {runningStep === 'sbo-track-results' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-lg">📋</span>}
          <span className="text-[10px] font-semibold">Track Results</span>
          <span className="text-[9px] text-muted-foreground">Grade last night</span>
        </Button>
      </div>

      {/* SCHEDULE STATUS */}
      <ScheduleStatus />

      {/* LIVE PROGRESS */}
      {(running || liveProgress.length > 0) && (
        <Card className="border-primary/20">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              {running && <Loader2 className="w-3 h-3 animate-spin" />}
              {running ? 'Running...' : 'Last run results'}
            </p>
            {ALL_STEPS.map(step => {
              const result = liveProgress.find((p: any) => p.fn === step.fn);
              const isStepRunning = running && !result;
              return (
                <div key={step.fn} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-center flex-shrink-0">
                    {result?.status === 'success' ? <CheckCircle className="w-3 h-3 text-green-500" /> :
                     result?.status === 'warning' ? <AlertTriangle className="w-3 h-3 text-amber-500" /> :
                     isStepRunning ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> :
                     <span className="text-muted-foreground">·</span>}
                  </span>
                  <span className="flex-1 truncate">{step.icon} {step.label}</span>
                  {result && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {result.records?.toLocaleString() || 0} records · {(result.duration_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* API COST AWARENESS */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-primary" />
            API Cost Awareness — This Month
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          {Object.entries(API_COST_INFO).map(([provider, info]) => {
            const usage = monthlyCosts?.[provider];
            const calls = usage?.calls || 0;
            const pct = info.freeLimit ? Math.min((calls / info.freeLimit) * 100, 100) : 0;
            const isWarning = info.freeLimit ? pct >= 80 : false;

            return (
              <div key={provider} className={`rounded-lg p-2.5 border ${info.borderColor} ${info.bgColor}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>
                  <Badge variant="outline" className="text-[9px] h-4">{info.costPerUnit}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground mb-1.5">
                  <span>{calls.toLocaleString()} API calls this month</span>
                  <span>{(usage?.records || 0).toLocaleString()} records pulled</span>
                </div>
                {info.freeLimit && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className={isWarning ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
                        {pct.toFixed(0)}% of free tier used
                      </span>
                      <span className="text-muted-foreground">{calls} / {info.freeLimit} requests</span>
                    </div>
                    <Progress value={pct} className={`h-1.5 ${isWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`} />
                    {isWarning && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Approaching free tier limit — consider upgrading
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[9px] text-muted-foreground mt-1">{info.notes}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* INDIVIDUAL STEP CONTROLS */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-primary" />
            Individual Step Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-1.5">
          {ALL_STEPS.map(step => {
            const isStepRunning = runningStep === step.fn;
            return (
              <div key={step.fn} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/10">
                <span className="text-sm flex-shrink-0">{step.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{step.label}</p>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1">{step.cost}</Badge>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {step.when}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" disabled={isStepRunning || running} onClick={() => runSingleStep(step.fn, step.label)}>
                  {isStepRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  <span className="ml-1">Run</span>
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* DATA LIBRARY */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-primary" />
            Your NBA Data Library
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(counts || {}).map(([table, count]) => (
              <div key={table} className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-sm font-bold">{(count as number).toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">
                  {tableLabels[table] || table.replace('sbo_', '')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* RECENT ENGINE RUNS */}
      {(engineRuns?.length || 0) > 0 && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Recent Day Engine Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1.5">
            {engineRuns?.slice(0, 5).map((run: any) => (
              <div key={run.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/20">
                <TrendingUp className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground flex-shrink-0">
                  {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="flex-1 truncate">
                  {run.run_type} · {(run.total_records_synced || 0).toLocaleString()} records
                </span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {run.duration_seconds ? `${run.duration_seconds}s` : '...'}
                </span>
                <Badge
                  variant={run.status === 'completed' ? 'default' : run.status === 'partial' ? 'secondary' : 'destructive'}
                  className="text-[9px] h-4"
                >
                  {run.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* HOW IT WORKS */}
      <div className="bg-muted/20 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold">Recommended Daily Schedule</p>
        <div className="space-y-1.5">
          {[
            { time: '8:00 AM', action: 'Morning Sync', detail: 'Stats, injuries, standings — SportsDataIO' },
            { time: '6:00 PM', action: 'Pre-Game Sync', detail: 'Odds, props, projections, Polymarket — 1 Odds API call' },
            { time: 'Game time', action: 'Run predictions', detail: 'All 4 brains now have real current data' },
            { time: '11:00 PM', action: 'Track Results', detail: 'Auto-grades predictions against final scores' },
          ].map(s => (
            <div key={s.time} className="flex items-start gap-2 text-[10px]">
              <span className="font-mono text-muted-foreground w-16 flex-shrink-0">{s.time}</span>
              <div>
                <span className="font-medium">{s.action}</span>
                <span className="text-muted-foreground"> — {s.detail}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground mt-2">
          Total daily cost: ~1 Odds API request (0.2% of free tier) + SportsDataIO subscription + PrizePicks & Polymarket free.
        </p>
      </div>
    </div>
  );
}
