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
};

const DAY_ENGINE_STEPS = {
  morning: [
    {
      fn: 'sbo-sync-daily',
      label: 'Season Stats + Injuries + Standings',
      icon: '📊',
      provider: 'sportsdata_io',
      cost: '$0 (subscription)',
      when: '8:00 AM',
    },
  ],
  pregame: [
    {
      fn: 'sbo-fetch-odds',
      label: 'Live Odds — DK / FanDuel / BetMGM / Caesars',
      icon: '💰',
      provider: 'the_odds_api',
      cost: '1 request',
      when: '6:00 PM',
    },
    {
      fn: 'sbo-sync-pregame',
      label: 'Projections + Game Logs + SDIO Props',
      icon: '📈',
      provider: 'sportsdata_io',
      cost: '$0 (subscription)',
      when: '6:00 PM',
    },
    {
      fn: 'sbo-sync-prizepicks',
      label: 'PrizePicks Props',
      icon: '🎯',
      provider: 'prizepicks',
      cost: '$0 (free)',
      when: '6:00 PM',
    },
  ],
};

const ALL_STEPS = [...DAY_ENGINE_STEPS.morning, ...DAY_ENGINE_STEPS.pregame];

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
        'sbo_player_season_stats',
        'sbo_player_game_logs',
        'sbo_injuries',
        'sbo_player_projections',
        'sbo_sdio_props',
        'sbo_team_stats',
        'sbo_player_props',
        'sbo_predictions',
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
    sbo_predictions: 'Predictions Made',
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
            Automates all NBA data syncs — stats, odds, props, projections
          </p>
        </div>
        <Badge variant={running ? 'default' : 'secondary'} className="text-[10px]">
          <Activity className="w-3 h-3 mr-1" />
          {running ? 'Running...' : 'Idle'}
        </Badge>
      </div>

      {/* ONE-CLICK BUTTONS */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => runDayEngine('morning')}
          disabled={running}
          className="gap-1.5 flex-col h-auto py-3"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-lg">🌅</span>}
          <span className="text-[10px] font-semibold">Morning Sync</span>
          <span className="text-[9px] text-muted-foreground">Stats · Injuries · Standings</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => runDayEngine('pregame')}
          disabled={running}
          className="gap-1.5 flex-col h-auto py-3"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-lg">🏀</span>}
          <span className="text-[10px] font-semibold">Pre-Game Sync</span>
          <span className="text-[9px] text-muted-foreground">Odds · Props · Projections</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => runDayEngine('full')}
          disabled={running}
          className="gap-1.5 flex-col h-auto py-3 border-primary/40"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-primary" />}
          <span className="text-[10px] font-semibold">Full Sync</span>
          <span className="text-[9px] text-muted-foreground">All steps at once</span>
        </Button>
      </div>

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
                  <span className="flex-1 truncate">
                    {step.icon} {step.label}
                  </span>
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
                  <Badge variant="outline" className="text-[9px] h-4">
                    {info.costPerUnit}
                  </Badge>
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
                      <span className="text-muted-foreground">
                        {calls} / {info.freeLimit} requests
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={`h-1.5 ${isWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
                    />
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

          <div className="bg-muted/30 rounded-lg p-2.5 space-y-1">
            <p className="text-[10px] font-semibold">📊 The Odds API — Daily Cost Breakdown</p>
            <p className="text-[10px] text-muted-foreground">Fetch Live Odds (1 call): 1 request used</p>
            <p className="text-[10px] text-muted-foreground">Run nightly = 30 calls/month = 6% of free tier</p>
            <p className="text-[10px] text-muted-foreground">Run twice daily = 60 calls/month = 12% of free tier</p>
            <p className="text-[10px] text-muted-foreground font-medium">Free tier resets monthly. At current usage you will never hit the limit.</p>
            <p className="text-[9px] text-muted-foreground">If you upgrade to paid: 500 calls costs ~$0.50 at the $50/mo plan.</p>
          </div>
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
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                      {step.cost}
                    </Badge>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {step.when}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  disabled={isStepRunning || running}
                  onClick={() => runSingleStep(step.fn, step.label)}
                >
                  {isStepRunning
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />
                  }
                  <span className="ml-1">Run</span>
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* YOUR DATA LIBRARY */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-primary" />
            Your NBA Data Library
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-4 gap-2">
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
            { time: '8:00 AM', action: 'Click Morning Sync', detail: 'Updates season stats, injuries, standings — 1 SportsDataIO call' },
            { time: '6:00 PM', action: 'Click Pre-Game Sync', detail: 'Pulls projections, DK/FD/BetMGM props, game logs — 2 SDIO calls + 1 Odds API call' },
            { time: '6:05 PM', action: 'Click Full Sync or individual PrizePicks', detail: 'Auto-fills all NBA props from PrizePicks — free' },
            { time: 'Game time', action: 'Run predictions', detail: 'All 3 brains now have real current data' },
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
          Total daily cost: ~3 Odds API requests (0.6% of free tier) + SportsDataIO subscription + PrizePicks free.
          At current usage you will never exceed the free tier limits.
        </p>
      </div>
    </div>
  );
}