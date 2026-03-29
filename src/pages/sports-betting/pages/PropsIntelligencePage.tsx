import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, Zap, Search, TrendingUp, TrendingDown, Trophy, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useUnifiedProps, UnifiedProp } from '@/hooks/useUnifiedProps';
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

export default function PropsIntelligencePage() {
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [bestOnly, setBestOnly] = useState(false);

  const { data: props, isLoading: propsLoading } = useUnifiedProps();
  const { state: analysisState, feed: analysisFeed, startAnalysis, cancelAnalysis } = useAnalysisVisibility();

  const safeProps = useMemo(() => Array.isArray(props) ? props : [], [props]);

  const platforms = useMemo(() => [...new Set(safeProps.map(p => p.platform))], [safeProps]);

  // Group by player + stat_type
  const grouped = useMemo(() => {
    const map: Record<string, UnifiedProp[]> = {};
    for (const p of safeProps) {
      if (search && !p.player_name.toLowerCase().includes(search.toLowerCase())) continue;
      if (filterPlatform && p.platform !== filterPlatform) continue;
      if (bestOnly && !p.best_platform) continue;
      const key = `${p.player_name}::${p.stat_type}`;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return Object.entries(map).sort((a, b) => {
      const maxA = Math.max(...a[1].map(p => p.ai_confidence || 0));
      const maxB = Math.max(...b[1].map(p => p.ai_confidence || 0));
      return maxB - maxA;
    });
  }, [safeProps, search, filterPlatform, bestOnly]);

  const handleRunAnalysis = () => {
    startAnalysis();
    toast.success('Analysis started — watch the live feed!');
  };

  const isRunning = analysisState.isRunning;

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-lime-400" />
            Props Intelligence Engine
          </h1>
          <p className="text-sm text-muted-foreground">
            Unified cross-platform prop analysis — all sources, one engine
          </p>
        </div>
        <Button
          onClick={handleRunAnalysis}
          disabled={isRunning || startAnalysis.isPending}
          className="bg-lime-600 hover:bg-lime-700"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          {isRunning ? 'Running...' : 'Run Analysis'}
        </Button>
      </div>

      {/* JOB STATUS */}
      {job && isRunning && (
        <Card className="border-lime-500/30 bg-lime-500/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-lime-400">
                Analysis in progress — you can leave this page safely
              </span>
              <Badge variant="outline" className="text-lime-400 border-lime-500/30">
                {job.progress}%
              </Badge>
            </div>
            <Progress value={job.progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {job?.status === 'completed' && job.results && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-400">
                ✅ Analysis complete — {job.results.total_props} props across {job.results.platforms?.length || 0} platforms, {job.results.players} players
              </span>
              <span className="text-xs text-muted-foreground">
                {job.results.best_picks} best picks found
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {job?.status === 'failed' && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3">
            <span className="text-sm text-destructive">❌ Analysis failed: {job.error_message}</span>
          </CardContent>
        </Card>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={bestOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBestOnly(!bestOnly)}
        >
          <Trophy className="h-3 w-3 mr-1" />
          Best Picks Only
        </Button>
        {platforms.map(p => (
          <Button
            key={p}
            variant={filterPlatform === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterPlatform(filterPlatform === p ? null : p)}
          >
            {p}
          </Button>
        ))}
      </div>

      {/* STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="bg-card/50">
          <CardContent className="py-2 text-center">
            <div className="text-lg font-bold text-foreground">{safeProps.length}</div>
            <div className="text-xs text-muted-foreground">Total Props</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="py-2 text-center">
            <div className="text-lg font-bold text-foreground">{platforms.length}</div>
            <div className="text-xs text-muted-foreground">Platforms</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="py-2 text-center">
            <div className="text-lg font-bold text-lime-400">
              {safeProps.filter(p => p.best_platform && (p.ai_confidence || 0) >= 70).length}
            </div>
            <div className="text-xs text-muted-foreground">Best Picks</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="py-2 text-center">
            <div className="text-lg font-bold text-foreground">
              {safeProps.filter(p => p.season_avg).length}
            </div>
            <div className="text-xs text-muted-foreground">With Stats</div>
          </CardContent>
        </Card>
      </div>

      {/* PROPS TABLE */}
      {propsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : grouped.length === 0 ? (
        <Card className="bg-card/50">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No props found. Run analysis to populate.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(([key, entries]) => {
            const best = entries.find(e => e.best_platform);
            const topConf = Math.max(...entries.map(e => e.ai_confidence || 0));
            const direction = entries[0]?.ai_direction;

            return (
              <Card key={key} className={`bg-card/80 border ${topConf >= 70 ? 'border-lime-500/30' : 'border-border/50'}`}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {entries[0].player_name}
                        <Badge variant="outline" className="text-xs">
                          {normalize(entries[0].stat_type)}
                        </Badge>
                        {entries[0].team && (
                          <span className="text-xs text-muted-foreground">{entries[0].team}</span>
                        )}
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
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }>
                          {direction === 'OVER'
                            ? <TrendingUp className="h-3 w-3 mr-1" />
                            : <TrendingDown className="h-3 w-3 mr-1" />}
                          {direction}
                        </Badge>
                      )}
                      {topConf > 0 && (
                        <Badge className={
                          topConf >= 80 ? 'bg-lime-500/20 text-lime-400' :
                          topConf >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-muted text-muted-foreground'
                        }>
                          {topConf}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Platform lines */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 mt-2">
                    {entries.map((e, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-3 py-1.5 rounded text-sm ${
                          e.best_platform
                            ? 'bg-lime-500/10 border border-lime-500/30'
                            : 'bg-muted/30'
                        }`}
                      >
                        <span className="font-medium text-foreground flex items-center gap-1">
                          {e.best_platform && <Trophy className="h-3 w-3 text-lime-400" />}
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
