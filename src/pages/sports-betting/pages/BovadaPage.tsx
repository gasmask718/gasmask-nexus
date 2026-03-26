import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Zap, Search, TrendingUp, TrendingDown, Trophy, RefreshCw,
  ArrowRightLeft, Filter, Flame, Diamond, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUnifiedProps, useAnalysisJob, UnifiedProp } from '@/hooks/useUnifiedProps';
import { useCrossPlatformProps, type CrossPlatformProp } from '@/hooks/useCrossPlatformProps';
import { PropStatContextCard } from '@/components/sbo/PropStatContextCard';

const PROP_LABELS: Record<string, string> = {
  points: 'Points', pts: 'Points', player_points: 'Points',
  rebounds: 'Rebounds', reb: 'Rebounds',
  assists: 'Assists', ast: 'Assists',
  threes: '3-Pointers', blocks: 'Blocks', steals: 'Steals',
  pra: 'Pts+Reb+Ast', pts_reb_ast: 'Pts+Reb+Ast',
  pts_reb: 'Pts+Reb', pts_ast: 'Pts+Ast', reb_ast: 'Reb+Ast',
  fantasy_points: 'Fantasy', minutes: 'Minutes',
};
const normalize = (t: string) => PROP_LABELS[t?.toLowerCase()?.trim()] || t;

const SOURCE_COLORS: Record<string, string> = {
  bovada: 'bg-red-500/15 text-red-500 border-red-500/30',
  draftkings: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  fanduel: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  betmgm: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  prizepicks: 'bg-pink-500/15 text-pink-500 border-pink-500/30',
};

function getValueTier(confidence: number, edge: number): { label: string; icon: any; className: string } {
  const score = (confidence / 100) * Math.abs(edge);
  if (score >= 1.5) return { label: 'Elite', icon: Flame, className: 'text-orange-400 bg-orange-500/15 border-orange-500/30' };
  if (score >= 0.8) return { label: 'Strong', icon: Diamond, className: 'text-lime-400 bg-lime-500/15 border-lime-500/30' };
  return { label: 'Medium', icon: AlertTriangle, className: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' };
}

// ═══ PARLAY SLIP STATE ═══
interface ParlayLeg {
  player: string;
  stat: string;
  direction: string;
  line: number;
  platform: string;
  confidence: number;
}

export default function BovadaPage() {
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [bestOnly, setBestOnly] = useState(false);
  const [highConfOnly, setHighConfOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [parlayLegs, setParlayLegs] = useState<ParlayLeg[]>([]);

  const { data: props, isLoading: propsLoading } = useUnifiedProps();
  const { data: crossProps, refetch: refetchCross } = useCrossPlatformProps();
  const { job, startAnalysis } = useAnalysisJob();

  const safeProps = useMemo(() => Array.isArray(props) ? props : [], [props]);
  const safeCross = useMemo(() => Array.isArray(crossProps) ? crossProps : [], [crossProps]);

  const platforms = useMemo(() => [...new Set(safeProps.map(p => p.platform))], [safeProps]);

  // ═══ GROUPED PROPS ═══
  const grouped = useMemo(() => {
    const map: Record<string, UnifiedProp[]> = {};
    for (const p of safeProps) {
      if (search && !p.player_name.toLowerCase().includes(search.toLowerCase())) continue;
      if (filterPlatform !== 'all' && p.platform !== filterPlatform) continue;
      if (bestOnly && !p.best_platform) continue;
      if (highConfOnly && (p.ai_confidence || 0) < 70) continue;
      const key = `${p.player_name}::${p.stat_type}`;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return Object.entries(map).sort((a, b) => {
      const maxA = Math.max(...a[1].map(p => p.ai_confidence || 0));
      const maxB = Math.max(...b[1].map(p => p.ai_confidence || 0));
      return maxB - maxA;
    });
  }, [safeProps, search, filterPlatform, bestOnly, highConfOnly]);

  // ═══ ACTIONS ═══
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-ingest-book-props', {
        body: { bookmakers: 'bovada,betonlineag,draftkings,fanduel,betmgm' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Ingested: ${data.inserted} new, ${data.updated} updated`);
      refetchCross();
    } catch (e: any) {
      toast.error(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRunAnalysis = () => {
    startAnalysis.mutate(undefined, {
      onSuccess: () => toast.success('Analysis job queued — runs in background!'),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const addToParlay = (entry: UnifiedProp) => {
    if (parlayLegs.some(l => l.player === entry.player_name && l.stat === entry.stat_type)) {
      toast.info('Already in parlay');
      return;
    }
    setParlayLegs(prev => [...prev, {
      player: entry.player_name,
      stat: entry.stat_type,
      direction: entry.ai_direction || 'OVER',
      line: entry.line,
      platform: entry.platform,
      confidence: entry.ai_confidence || 0,
    }]);
    toast.success(`Added ${entry.player_name} to parlay`);
  };

  const removeFromParlay = (idx: number) => setParlayLegs(prev => prev.filter((_, i) => i !== idx));

  const isRunning = job?.status === 'pending' || job?.status === 'running';
  const bestPicksCount = safeProps.filter(p => p.best_platform && (p.ai_confidence || 0) >= 70).length;
  const withStatsCount = safeProps.filter(p => p.season_avg).length;
  const combinedParlayConf = parlayLegs.length > 0
    ? Math.round(parlayLegs.reduce((acc, l) => acc * (l.confidence / 100), 1) * 100)
    : 0;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-lime-400" />
            Bovada Intelligence Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            All props. All platforms. One execution engine.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sync Books
          </Button>
          <Button
            size="sm"
            onClick={handleRunAnalysis}
            disabled={isRunning || startAnalysis.isPending}
            className="bg-lime-600 hover:bg-lime-700"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            {isRunning ? 'Running...' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* ═══ SECTION 7: LIVE STATUS ═══ */}
      {job && isRunning && (
        <Card className="border-lime-500/30 bg-lime-500/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-lime-400">
                Analysis in progress — you can leave this page safely
              </span>
              <Badge variant="outline" className="text-lime-400 border-lime-500/30">{job.progress}%</Badge>
            </div>
            <Progress value={job.progress} className="h-2" />
          </CardContent>
        </Card>
      )}
      {job?.status === 'completed' && job.results && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-3">
            <span className="text-sm text-emerald-400">
              ✅ Analysis complete — {job.results.total_props} props, {job.results.players} players, {job.results.best_picks} best picks
            </span>
          </CardContent>
        </Card>
      )}
      {job?.status === 'failed' && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3">
            <span className="text-sm text-destructive">❌ {job.error_message}</span>
          </CardContent>
        </Card>
      )}

      {/* ═══ SECTION 1: FILTER + CONTROL BAR ═══ */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search player..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
          <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={bestOnly ? 'default' : 'outline'} size="sm" onClick={() => setBestOnly(!bestOnly)}>
          <Trophy className="h-3 w-3 mr-1" /> Best Picks
        </Button>
        <Button variant={highConfOnly ? 'default' : 'outline'} size="sm" onClick={() => setHighConfOnly(!highConfOnly)}>
          <Flame className="h-3 w-3 mr-1" /> High Conf ≥70%
        </Button>
      </div>

      {/* ═══ STATS BAR ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'Total Props', value: safeProps.length, color: '' },
          { label: 'Platforms', value: platforms.length, color: '' },
          { label: 'Best Picks', value: bestPicksCount, color: 'text-lime-400' },
          { label: 'With Stats', value: withStatsCount, color: '' },
          { label: 'No Stats', value: safeProps.length - withStatsCount, color: withStatsCount < safeProps.length ? 'text-yellow-400' : '' },
        ].map(s => (
          <Card key={s.label} className="bg-card/50">
            <CardContent className="py-2 text-center">
              <div className={`text-lg font-bold ${s.color || 'text-foreground'}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ═══ SECTION 2+3+4+5: SIGNAL GRID ═══ */}
        <div className="lg:col-span-2 space-y-3">
          {propsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : grouped.length === 0 ? (
            <Card className="bg-card/50">
              <CardContent className="py-12 text-center space-y-3">
                <p className="text-muted-foreground">No props found. Sync books and run analysis to populate.</p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={handleSync} disabled={syncing}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Sync Books
                  </Button>
                  <Button size="sm" onClick={handleRunAnalysis} disabled={isRunning} className="bg-lime-600 hover:bg-lime-700">
                    <Zap className="h-4 w-4 mr-1" /> Run Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            grouped.map(([key, entries]) => {
              const best = entries.find(e => e.best_platform);
              const topConf = Math.max(...entries.map(e => e.ai_confidence || 0));
              const topEdge = Math.max(...entries.map(e => Math.abs(e.edge_vs_line || 0)));
              const direction = entries[0]?.ai_direction;
              const valueTier = topConf > 0 && topEdge > 0 ? getValueTier(topConf, topEdge) : null;
              const ValueIcon = valueTier?.icon;
              const hasMissingStats = !entries[0]?.season_avg;

              return (
                <Card key={key} className={`bg-card/80 border ${topConf >= 70 ? 'border-lime-500/30' : 'border-border/50'}`}>
                  <CardContent className="py-3 space-y-2">
                    {/* Player header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {entries[0].player_name}
                          <Badge variant="outline" className="text-xs">{normalize(entries[0].stat_type)}</Badge>
                          {entries[0].team && <span className="text-xs text-muted-foreground">{entries[0].team}</span>}
                          {hasMissingStats && (
                            <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 text-[10px]">
                              ⚠ DATA ISSUE
                            </Badge>
                          )}
                        </div>
                        {entries[0].season_avg && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Season: {entries[0].season_avg} | L5: {entries[0].l5_avg || '—'} | L10: {entries[0].l10_avg || '—'}
                            {entries[0].matchup_avg && ` | Matchup: ${entries[0].matchup_avg}`}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {valueTier && ValueIcon && (
                          <Badge variant="outline" className={`text-[10px] ${valueTier.className}`}>
                            <ValueIcon className="h-3 w-3 mr-0.5" /> {valueTier.label}
                          </Badge>
                        )}
                        {direction && (
                          <Badge className={direction === 'OVER'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                            {direction === 'OVER' ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                            {direction}
                          </Badge>
                        )}
                        {topConf > 0 && (
                          <Badge className={
                            topConf >= 80 ? 'bg-lime-500/20 text-lime-400' :
                            topConf >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-muted text-muted-foreground'
                          }>{topConf}%</Badge>
                        )}
                      </div>
                    </div>

                    {/* SECTION 3: Platform comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {entries.map((e, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between px-3 py-1.5 rounded text-sm ${
                            e.best_platform ? 'bg-lime-500/10 border border-lime-500/30' : 'bg-muted/30'
                          }`}
                        >
                          <span className="font-medium text-foreground flex items-center gap-1">
                            {e.best_platform && <Trophy className="h-3 w-3 text-lime-400" />}
                            <Badge variant="outline" className={`text-[10px] px-1 ${SOURCE_COLORS[e.platform.toLowerCase()] || ''}`}>
                              {e.platform}
                            </Badge>
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-foreground">{e.line}</span>
                            {e.over_odds && <span className="text-muted-foreground">O{e.over_odds > 0 ? '+' : ''}{e.over_odds}</span>}
                            {e.edge_vs_line !== null && (
                              <span className={(e.edge_vs_line || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                {(e.edge_vs_line || 0) > 0 ? '+' : ''}{e.edge_vs_line}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* SECTION 4: Execution layer */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => addToParlay(best || entries[0])}
                      >
                        + Parlay
                      </Button>
                      {best && (
                        <span className="text-[10px] text-lime-400 flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> Best: {best.platform} @ {best.line}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* ═══ SECTION 6: PARLAY BUILDER (RIGHT SIDEBAR) ═══ */}
        <div className="space-y-3">
          <Card className="border-lime-500/20 sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-lime-400" />
                Parlay Builder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {parlayLegs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Click "+ Parlay" on any prop to build your slip
                </p>
              ) : (
                <>
                  {parlayLegs.map((leg, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                      <div>
                        <span className="font-medium text-foreground">{leg.player}</span>
                        <span className="text-muted-foreground ml-1">{normalize(leg.stat)}</span>
                        <Badge className={`ml-1 text-[9px] ${leg.direction === 'OVER' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {leg.direction} {leg.line}
                        </Badge>
                      </div>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeFromParlay(i)}>×</Button>
                    </div>
                  ))}
                  <div className="border-t border-border/50 pt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Legs</span>
                      <span className="font-medium text-foreground">{parlayLegs.length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Combined Confidence</span>
                      <span className={`font-medium ${combinedParlayConf >= 30 ? 'text-lime-400' : 'text-red-400'}`}>{combinedParlayConf}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Risk Level</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        parlayLegs.length <= 2 ? 'text-emerald-400 border-emerald-500/30' :
                        parlayLegs.length <= 4 ? 'text-yellow-400 border-yellow-500/30' :
                        'text-red-400 border-red-500/30'
                      }`}>
                        {parlayLegs.length <= 2 ? 'Low' : parlayLegs.length <= 4 ? 'Medium' : 'High'}
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setParlayLegs([])}>
                    Clear Slip
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
