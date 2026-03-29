import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Zap, Search, TrendingUp, TrendingDown, Trophy, RefreshCw, CheckCircle, XCircle, Clock, Brain, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUnifiedProps, UnifiedProp, getCoverageMode, setCoverageMode, getAnalysisLock, type CoverageMode } from '@/hooks/useUnifiedProps';
import { LiveAnalysisPanel } from '@/components/betting/LiveAnalysisPanel';
import { useAnalysisVisibility } from '@/hooks/useAnalysisVisibility';

const PROP_LABELS: Record<string, string> = {
  points: 'Points', pts: 'Points', player_points: 'Points',
  rebounds: 'Rebounds', reb: 'Rebounds',
  assists: 'Assists', ast: 'Assists',
  threes: '3-Pointers', blocks: 'Blocks', steals: 'Steals',
  pra: 'Pts+Reb+Ast', fantasy_points: 'Fantasy',
};
const normalize = (t: string) => PROP_LABELS[t?.toLowerCase()?.trim()] || t;

type ResultFilter = 'all' | 'won' | 'lost' | 'pending';

export default function PropsIntelligencePage() {
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [bestOnly, setBestOnly] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [coverageMode, setCoverageModeState] = useState<CoverageMode>(getCoverageMode);

  const { data: props, isLoading: propsLoading } = useUnifiedProps(undefined, coverageMode);
  const { state: analysisState, feed: analysisFeed, skippedCount, startAnalysis, cancelAnalysis } = useAnalysisVisibility();

  const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const { data: predictionCount = 0 } = useQuery({
    queryKey: ['prediction-count', todayEST],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('sbo_prop_predictions')
        .select('*', { count: 'exact', head: true })
        .eq('game_date', todayEST);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 5000,
  });

  const safeProps = useMemo(() => Array.isArray(props) ? props : [], [props]);
  const platforms = useMemo(() => [...new Set(safeProps.map(p => p.platform))], [safeProps]);

  // Result counts
  const resultCounts = useMemo(() => {
    const counts = { all: safeProps.length, won: 0, lost: 0, pending: 0 };
    for (const p of safeProps) {
      const r = (p as any).result?.toLowerCase?.();
      if (r === 'won' || r === 'win') counts.won++;
      else if (r === 'lost' || r === 'loss') counts.lost++;
      else counts.pending++;
    }
    return counts;
  }, [safeProps]);

  // Group by player + stat_type with all filters
  const grouped = useMemo(() => {
    const map: Record<string, UnifiedProp[]> = {};
    for (const p of safeProps) {
      if (search && !p.player_name.toLowerCase().includes(search.toLowerCase())) continue;
      if (filterPlatform && p.platform !== filterPlatform) continue;
      if (bestOnly && !p.best_platform) continue;

      // Result filter
      if (resultFilter !== 'all') {
        const r = (p as any).result?.toLowerCase?.() || '';
        if (resultFilter === 'won' && r !== 'won' && r !== 'win') continue;
        if (resultFilter === 'lost' && r !== 'lost' && r !== 'loss') continue;
        if (resultFilter === 'pending' && (r === 'won' || r === 'win' || r === 'lost' || r === 'loss')) continue;
      }

      const key = `${p.player_name}::${p.stat_type}`;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return Object.entries(map).sort((a, b) => {
      const maxA = Math.max(...a[1].map(p => p.ai_confidence || 0));
      const maxB = Math.max(...b[1].map(p => p.ai_confidence || 0));
      return maxB - maxA;
    });
  }, [safeProps, search, filterPlatform, bestOnly, resultFilter]);

  const handleRunAnalysis = () => {
    startAnalysis(false);
    toast.success('Analysis started — duplicates will be skipped!');
  };

  const handleForceRerun = () => {
    startAnalysis(true);
    toast.success('Force re-run — all props will be re-analyzed!');
  };

  const handleToggleCoverage = () => {
    const newMode: CoverageMode = coverageMode === 'limited' ? 'expanded' : 'limited';
    setCoverageMode(newMode);
    setCoverageModeState(newMode);
    toast.success(newMode === 'expanded' ? '🔓 Coverage expanded — all dates loaded' : '🔒 Coverage limited to today');
  };

  const isRunning = analysisState.isRunning;

  const RESULT_FILTERS: { value: ResultFilter; label: string; icon: React.ReactNode; color: string; activeClass: string }[] = [
    { value: 'all', label: 'All', icon: null, color: 'text-foreground', activeClass: 'bg-primary text-primary-foreground' },
    { value: 'won', label: 'Won', icon: <CheckCircle className="h-3 w-3" />, color: 'text-emerald-400', activeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
    { value: 'lost', label: 'Lost', icon: <XCircle className="h-3 w-3" />, color: 'text-red-400', activeClass: 'bg-red-500/20 text-red-400 border-red-500/50' },
    { value: 'pending', label: 'Pending', icon: <Clock className="h-3 w-3" />, color: 'text-yellow-400', activeClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
  ];

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Props Intelligence Engine
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Unified cross-platform prop analysis — all sources, one engine
            {isRunning && (
              <Badge variant="outline" className="text-xs border-primary/50 text-primary animate-pulse">
                <Lock className="h-3 w-3 mr-1" /> Dataset Locked
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={coverageMode === 'expanded' ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleCoverage}
            className={coverageMode === 'expanded' ? 'bg-primary text-primary-foreground' : ''}
          >
            {coverageMode === 'expanded' ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
            {coverageMode === 'expanded' ? 'Expanded 🔒' : 'Expand Coverage'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleForceRerun} disabled={isRunning}>
            <RefreshCw className="h-3 w-3 mr-1" /> Re-run All
          </Button>
          <Button onClick={handleRunAnalysis} disabled={isRunning} className="bg-primary hover:bg-primary/90">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            {isRunning ? 'Running...' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* LIVE ANALYSIS PANEL */}
      {analysisState.status !== 'idle' && (
        <LiveAnalysisPanel state={analysisState} feed={analysisFeed} onCancel={cancelAnalysis} skippedCount={skippedCount} />
      )}

      {/* RESULT FILTER BAR */}
      <div className="flex flex-wrap gap-2">
        {RESULT_FILTERS.map(f => {
          const count = resultCounts[f.value];
          const isActive = resultFilter === f.value;
          return (
            <Button
              key={f.value}
              variant="outline"
              size="sm"
              className={`gap-1.5 ${isActive ? f.activeClass : ''}`}
              onClick={() => setResultFilter(f.value)}
            >
              {f.icon}
              {f.label}
              <Badge variant="secondary" className={`ml-1 text-xs px-1.5 py-0 ${isActive ? 'bg-background/20' : ''}`}>
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* SEARCH + PLATFORM FILTERS */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search player..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant={bestOnly ? 'default' : 'outline'} size="sm" onClick={() => setBestOnly(!bestOnly)}>
          <Trophy className="h-3 w-3 mr-1" /> Best Picks Only
        </Button>
        {platforms.map(p => (
          <Button key={p} variant={filterPlatform === p ? 'default' : 'outline'} size="sm" onClick={() => setFilterPlatform(filterPlatform === p ? null : p)}>
            {p}
          </Button>
        ))}
      </div>

      {/* STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card className="bg-card/50"><CardContent className="py-2 text-center">
          <div className="text-lg font-bold text-foreground">{safeProps.length}</div>
          <div className="text-xs text-muted-foreground">Total Props</div>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="py-2 text-center">
          <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
            <Brain className="h-4 w-4 text-primary" />
            {predictionCount}
          </div>
          <div className="text-xs text-muted-foreground">Predicted</div>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="py-2 text-center">
          <div className="text-lg font-bold text-muted-foreground">{Math.max(0, safeProps.length - predictionCount)}</div>
          <div className="text-xs text-muted-foreground">Remaining</div>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="py-2 text-center">
          <div className="text-lg font-bold text-emerald-400">{resultCounts.won}</div>
          <div className="text-xs text-muted-foreground">Won</div>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="py-2 text-center">
          <div className="text-lg font-bold text-yellow-400">{resultCounts.pending}</div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </CardContent></Card>
      </div>

      {/* PROPS TABLE */}
      {propsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : grouped.length === 0 ? (
        <Card className="bg-card/50">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {resultFilter !== 'all'
                ? `No ${resultFilter} results found. Try a different filter.`
                : 'No props found. Run analysis to populate.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(([key, entries]) => {
            const topConf = Math.max(...entries.map(e => e.ai_confidence || 0));
            const direction = entries[0]?.ai_direction;

            return (
              <Card key={key} className={`bg-card/80 border ${topConf >= 70 ? 'border-emerald-500/30' : 'border-border/50'}`}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {entries[0].player_name}
                        <Badge variant="outline" className="text-xs">{normalize(entries[0].stat_type)}</Badge>
                        {entries[0].team && <span className="text-xs text-muted-foreground">{entries[0].team}</span>}
                      </div>
                      {entries[0].season_avg && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Season: {entries[0].season_avg} | L5: {entries[0].l5_avg || '—'} | L10: {entries[0].l10_avg || '—'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {direction && (
                        <Badge className={direction === 'OVER'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                          {direction === 'OVER' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {direction}
                        </Badge>
                      )}
                      {topConf > 0 && (
                        <Badge className={
                          topConf >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                          topConf >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-muted text-muted-foreground'
                        }>{topConf}%</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 mt-2">
                    {entries.map((e, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded text-sm ${
                        e.best_platform ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-muted/30'
                      }`}>
                        <span className="font-medium text-foreground flex items-center gap-1">
                          {e.best_platform && <Trophy className="h-3 w-3 text-emerald-400" />}
                          {e.platform}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-foreground">{e.line}</span>
                          {e.edge_vs_line !== null && (
                            <span className={e.edge_vs_line > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {e.edge_vs_line > 0 ? '+' : ''}{e.edge_vs_line}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
