import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Database, RefreshCw, Shield, Download, CheckCircle, XCircle, Clock, AlertTriangle, Search, Calendar, Target, History, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

export default function ExternalResultsPanel() {
  const [sport, setSport] = useState('NBA');
  const [gameDate, setGameDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [fetching, setFetching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStart, setBackfillStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [backfillEnd, setBackfillEnd] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['external-results-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sbo-external-results', {
        body: { mode: 'status' },
      });
      if (error) throw error;
      return data as {
        external_results_count: number;
        unresolved_capper_picks: number;
        externally_resolved_picks: number;
        by_sport: Record<string, number>;
        match_quality: { exact: number; fuzzy: number; team: number; unmatched: number };
        isolation: string;
      };
    },
  });

  const { data: recentResults, refetch: refetchResults } = useQuery({
    queryKey: ['external-results-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sbo_external_results')
        .select('id, sport, game_date, player_name, stat_type, actual_value, home_team, away_team, home_score, away_score, winner, source, api_provider')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: matchLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['external-match-logs'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sbo-external-results', {
        body: { mode: 'match_logs', limit: 100 },
      });
      if (error) throw error;
      return data as {
        logs: Array<{
          id: string; pick_id: string; external_result_id: string | null;
          match_type: string; match_confidence: number;
          match_details: Record<string, unknown>; result: string | null; created_at: string;
        }>;
        summary: { total: number; exact: number; fuzzy: number; team: number; unmatched: number };
      };
    },
  });

  const { data: backfillLogs, refetch: refetchBackfillLogs } = useQuery({
    queryKey: ['backfill-logs'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sbo-external-results', {
        body: { mode: 'backfill_logs' },
      });
      if (error) throw error;
      return (data as { logs: Array<{
        id: string; sport: string; start_date: string; end_date: string;
        total_dates: number; total_games: number; total_player_stats: number;
        total_picks_found: number; resolved_count: number; failed_count: number;
        unmatched_count: number; wins: number; losses: number; pushes: number;
        roi_summary: number; status: string; errors: string[]; created_at: string; completed_at: string | null;
      }> }).logs;
    },
  });

  const handleFetch = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-external-results', {
        body: { mode: 'fetch', sport, game_date: gameDate },
      });
      if (error) throw error;
      toast.success(`Fetched ${data.games} games, ${data.player_stats} player stats`);
      refetchStatus(); refetchResults();
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch');
    } finally { setFetching(false); }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-external-results', {
        body: { mode: 'resolve', sport },
      });
      if (error) throw error;
      toast.success(`Resolved ${data.resolved} picks (${data.unmatched} unmatched). ${data.match_logs} logged.`);
      refetchStatus(); refetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve');
    } finally { setResolving(false); }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-external-results', {
        body: { mode: 'backfill', sport, start_date: backfillStart, end_date: backfillEnd },
      });
      if (error) throw error;
      toast.success(`Backfill complete: ${data.resolved} resolved, ${data.wins}W/${data.losses}L/${data.pushes}P, ROI: ${data.roi_summary}%`);
      refetchStatus(); refetchResults(); refetchBackfillLogs();
    } catch (err: any) {
      toast.error(err.message || 'Backfill failed');
    } finally { setBackfilling(false); }
  };

  const mq = status?.match_quality;
  const totalMatches = mq ? mq.exact + mq.fuzzy + mq.team + mq.unmatched : 0;

  return (
    <div className="space-y-6">
      {/* Isolation Banner */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-500">🔒 ISOLATED DATA LAYER</p>
            <p className="text-xs text-muted-foreground">
              External results are used for capper intelligence ONLY. Main props engine is untouched.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Database className="h-6 w-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{status?.external_results_count ?? '—'}</p>
            <p className="text-xs text-muted-foreground">External Results</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="h-6 w-6 mx-auto text-orange-500 mb-2" />
            <p className="text-2xl font-bold">{status?.unresolved_capper_picks ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Unresolved Picks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">{status?.externally_resolved_picks ?? '—'}</p>
            <p className="text-xs text-muted-foreground">API Resolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Target className="h-6 w-6 mx-auto text-purple-500 mb-2" />
            <p className="text-2xl font-bold">
              {totalMatches > 0 ? `${Math.round(((mq!.exact + mq!.fuzzy + mq!.team) / totalMatches) * 100)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Match Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Sport + Match Quality breakdown */}
      <div className="flex gap-2 flex-wrap">
        {status?.by_sport && Object.entries(status.by_sport).map(([s, count]) => (
          <Badge key={s} variant="secondary">{s}: {count}</Badge>
        ))}
        {mq && (
          <>
            <Badge variant="outline" className="text-green-500 border-green-500/30">Exact: {mq.exact}</Badge>
            <Badge variant="outline" className="text-amber-500 border-amber-500/30">Fuzzy: {mq.fuzzy}</Badge>
            <Badge variant="outline" className="text-blue-500 border-blue-500/30">Team: {mq.team}</Badge>
            <Badge variant="outline" className="text-red-500 border-red-500/30">Unmatched: {mq.unmatched}</Badge>
          </>
        )}
      </div>

      <Tabs defaultValue="fetch" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fetch" className="gap-1.5"><Download className="h-3.5 w-3.5" />Fetch & Resolve</TabsTrigger>
          <TabsTrigger value="backfill" className="gap-1.5"><Calendar className="h-3.5 w-3.5" />Backfill</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" />Backfill History</TabsTrigger>
          <TabsTrigger value="results" className="gap-1.5"><Database className="h-3.5 w-3.5" />Results</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><Search className="h-3.5 w-3.5" />Match Logs</TabsTrigger>
        </TabsList>

        {/* Fetch & Resolve */}
        <TabsContent value="fetch">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-500" />
                Fetch External Results
              </CardTitle>
              <CardDescription>Pull real box scores from SportsDataIO (isolated from main engine)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Sport</label>
                  <Select value={sport} onValueChange={setSport}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NBA">NBA</SelectItem>
                      <SelectItem value="NFL">NFL</SelectItem>
                      <SelectItem value="MLB">MLB</SelectItem>
                      <SelectItem value="NHL">NHL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Game Date</label>
                  <Input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} className="w-[160px]" />
                </div>
                <Button onClick={handleFetch} disabled={fetching} className="gap-2">
                  <Download className="h-4 w-4" />
                  {fetching ? 'Fetching...' : 'Fetch Results'}
                </Button>
                <Button onClick={handleResolve} disabled={resolving} variant="secondary" className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${resolving ? 'animate-spin' : ''}`} />
                  {resolving ? 'Resolving...' : 'Resolve Picks'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backfill */}
        <TabsContent value="backfill">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-500" />
                Historical Backfill + Auto-Resolve
              </CardTitle>
              <CardDescription>Fetch multiple days, auto-resolve picks, and compute capper stats in one run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Sport</label>
                  <Select value={sport} onValueChange={setSport}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NBA">NBA</SelectItem>
                      <SelectItem value="NFL">NFL</SelectItem>
                      <SelectItem value="MLB">MLB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <Input type="date" value={backfillStart} onChange={e => setBackfillStart(e.target.value)} className="w-[160px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <Input type="date" value={backfillEnd} onChange={e => setBackfillEnd(e.target.value)} className="w-[160px]" />
                </div>
                <Button onClick={handleBackfill} disabled={backfilling} variant="default" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  {backfilling ? 'Running Backfill...' : 'Run Backfill + Resolve'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚡ Backfill now auto-resolves picks and updates capper grades/ROI in one pass.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backfill History */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-amber-500" />
                Backfill Run History
              </CardTitle>
              <CardDescription>All historical backfill runs with resolution stats and ROI</CardDescription>
            </CardHeader>
            <CardContent>
              {!backfillLogs?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No backfill runs yet. Use the Backfill tab to start.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 pr-3">Date Range</th>
                        <th className="pb-2 pr-3">Sport</th>
                        <th className="pb-2 pr-3">Games</th>
                        <th className="pb-2 pr-3">Resolved</th>
                        <th className="pb-2 pr-3">W/L/P</th>
                        <th className="pb-2 pr-3">ROI</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2">Run Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {backfillLogs.map(log => (
                        <tr key={log.id} className="text-xs">
                          <td className="py-2 pr-3 font-medium">{log.start_date} → {log.end_date}</td>
                          <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{log.sport}</Badge></td>
                          <td className="py-2 pr-3 font-mono">{log.total_games}</td>
                          <td className="py-2 pr-3 font-mono">
                            <span className="text-green-500">{log.resolved_count}</span>
                            {log.unmatched_count > 0 && <span className="text-red-500 ml-1">/ {log.unmatched_count} ✗</span>}
                          </td>
                          <td className="py-2 pr-3 font-mono">
                            <span className="text-green-500">{log.wins}</span>/
                            <span className="text-red-500">{log.losses}</span>/
                            <span className="text-muted-foreground">{log.pushes}</span>
                          </td>
                          <td className={`py-2 pr-3 font-mono font-bold ${(log.roi_summary || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {(log.roi_summary || 0) >= 0 ? '+' : ''}{log.roi_summary || 0}%
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant={log.status === 'completed' ? 'default' : log.status === 'running' ? 'secondary' : 'destructive'} className="text-xs">
                              {log.status}
                            </Badge>
                          </td>
                          <td className="py-2 text-muted-foreground">{format(new Date(log.created_at), 'MMM d HH:mm')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Table */}
        <TabsContent value="results">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-500" />
                Recent External Results
              </CardTitle>
              <CardDescription>Latest data from API (capper intelligence only)</CardDescription>
            </CardHeader>
            <CardContent>
              {!recentResults?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No external results yet. Use "Fetch Results" to pull data.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 pr-3">Date</th>
                        <th className="pb-2 pr-3">Sport</th>
                        <th className="pb-2 pr-3">Player/Game</th>
                        <th className="pb-2 pr-3">Stat</th>
                        <th className="pb-2 pr-3">Value</th>
                        <th className="pb-2 pr-3">Game</th>
                        <th className="pb-2">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {recentResults.map(r => (
                        <tr key={r.id} className="text-xs">
                          <td className="py-2 pr-3">{r.game_date}</td>
                          <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{r.sport}</Badge></td>
                          <td className="py-2 pr-3 font-medium">{r.player_name || (r.winner ? `Winner: ${r.winner}` : '—')}</td>
                          <td className="py-2 pr-3">{r.stat_type || '—'}</td>
                          <td className="py-2 pr-3 font-mono">{r.actual_value ?? (r.home_score != null ? `${r.home_score}-${r.away_score}` : '—')}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{r.away_team} @ {r.home_team}</td>
                          <td className="py-2">
                            <Badge variant="secondary" className="text-xs">{r.api_provider || r.source}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Match Logs */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-amber-500" />
                Match Logs
              </CardTitle>
              <CardDescription>
                Debugging view: every match attempt logged with confidence scores
                {matchLogs?.summary && (
                  <span className="ml-2">
                    — {matchLogs.summary.exact} exact, {matchLogs.summary.fuzzy} fuzzy, {matchLogs.summary.team} team, {matchLogs.summary.unmatched} unmatched
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!matchLogs?.logs?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No match logs yet. Run "Resolve Picks" to generate logs.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 pr-3">Type</th>
                        <th className="pb-2 pr-3">Confidence</th>
                        <th className="pb-2 pr-3">Result</th>
                        <th className="pb-2 pr-3">Details</th>
                        <th className="pb-2">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {matchLogs.logs.map(log => (
                        <tr key={log.id} className="text-xs">
                          <td className="py-2 pr-3">
                            <Badge variant={
                              log.match_type === 'exact' ? 'default' :
                              log.match_type === 'fuzzy' ? 'secondary' :
                              log.match_type === 'team' ? 'outline' : 'destructive'
                            } className="text-xs">
                              {log.match_type}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 font-mono">
                            {log.match_confidence}%
                          </td>
                          <td className="py-2 pr-3">
                            {log.result === 'win' && <span className="text-green-500 font-medium">WIN</span>}
                            {log.result === 'loss' && <span className="text-red-500 font-medium">LOSS</span>}
                            {log.result === 'push' && <span className="text-muted-foreground">PUSH</span>}
                            {!log.result && <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground max-w-[200px] truncate">
                            {JSON.stringify(log.match_details).slice(0, 80)}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {format(new Date(log.created_at), 'MMM d HH:mm')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
