import { useState, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, TrendingUp, AlertTriangle, Zap, BarChart3, Target, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import BookPropsComparison from '@/components/sbo/BookPropsComparison';

const SPORT_OPTIONS = [
  { value: 'basketball_nba', label: 'NBA' },
  { value: 'americanfootball_nfl', label: 'NFL' },
  { value: 'baseball_mlb', label: 'MLB' },
  { value: 'icehockey_nhl', label: 'NHL' },
];

function formatOdds(odds: number | null) {
  if (odds == null) return '-';
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function edgeColor(score: number) {
  if (score >= 60) return 'text-green-500 bg-green-500/15 border-green-500/40';
  if (score >= 35) return 'text-amber-500 bg-amber-500/15 border-amber-500/40';
  return 'text-muted-foreground bg-muted/50 border-border';
}

function recBadge(rec: string) {
  if (rec === 'strong_play') return { label: '🔥 STRONG PLAY', cls: 'bg-green-500/20 text-green-400 border-green-500/40' };
  if (rec === 'medium_play') return { label: '⚡ MEDIUM PLAY', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
  return { label: 'MONITOR', cls: 'bg-muted text-muted-foreground' };
}

export default function CrossPlatformLines() {
  const [sport, setSport] = useState('basketball_nba');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const { data: lines, isLoading: linesLoading, refetch: refetchLines } = useQuery({
    queryKey: ['sportsbook-line-events', sport, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sportsbook_line_events')
        .select('*')
        .eq('sport', sport)
        .eq('game_date', today)
        .order('home_team');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: edges, isLoading: edgesLoading, refetch: refetchEdges } = useQuery({
    queryKey: ['sportsbook-edges', sport, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sportsbook_edge_analysis')
        .select('*')
        .eq('sport', sport)
        .eq('game_date', today)
        .order('edge_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: platforms } = useQuery({
    queryKey: ['sportsbook-platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sportsbook_platforms')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sportsbook-lines-ingest', {
        body: { sports: [sport] },
      });
      if (error) throw error;
      toast.success(`Ingested ${data.lines_ingested} lines, found ${data.edges_detected} edges`);
      await Promise.all([refetchLines(), refetchEdges()]);
    } catch (err: any) {
      toast.error(`Refresh failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Group lines by event for comparison view
  const eventGroups = (() => {
    if (!lines) return [];
    const groups: Record<string, typeof lines> = {};
    for (const line of lines) {
      const key = `${line.external_event_id}|${line.market_type}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(line);
    }
    return Object.entries(groups).map(([key, items]) => ({
      key,
      home_team: items[0].home_team,
      away_team: items[0].away_team,
      market_type: items[0].market_type,
      commence_time: items[0].commence_time,
      lines: items,
    }));
  })();

  const strongEdges = (edges || []).filter((e: any) => e.recommendation === 'strong_play');

  return (
    <div className="space-y-6 p-6">
      <div className="text-sm text-muted-foreground">
        Sports Betting &gt; <span className="text-foreground font-medium">Cross-Platform Lines</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Cross-Platform Lines</h1>
            <p className="text-muted-foreground text-sm">
              Compare odds across Bovada, DraftKings, FanDuel & more
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPORT_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} disabled={isRefreshing} size="sm">
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sync Lines
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-muted-foreground">Lines Tracked</div>
            <div className="text-2xl font-bold">{lines?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-muted-foreground">Platforms</div>
            <div className="text-2xl font-bold">{new Set(lines?.map((l: any) => l.platform_slug)).size || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-muted-foreground">Edges Found</div>
            <div className="text-2xl font-bold text-amber-400">{edges?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className={strongEdges.length > 0 ? 'border-green-500/40' : ''}>
          <CardContent className="pt-5">
            <div className="text-sm text-muted-foreground">Strong Plays</div>
            <div className="text-2xl font-bold text-green-400">{strongEdges.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="edges" className="space-y-4">
        <TabsList>
          <TabsTrigger value="edges" className="flex items-center gap-1">
            <Zap className="h-3 w-3" /> Edges
          </TabsTrigger>
          <TabsTrigger value="moneyline">Moneyline</TabsTrigger>
          <TabsTrigger value="spread">Spreads</TabsTrigger>
          <TabsTrigger value="total">Totals</TabsTrigger>
          <TabsTrigger value="props" className="flex items-center gap-1">
            <Target className="h-3 w-3" /> Player Props
          </TabsTrigger>
          <TabsTrigger value="platforms" className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> Platforms
          </TabsTrigger>
        </TabsList>

        {/* PLAYER PROPS TAB */}
        <TabsContent value="props">
          <BookPropsComparison />
        </TabsContent>

        {/* EDGES TAB */}
        <TabsContent value="edges" className="space-y-4">
          {edgesLoading ? (
            <Card><CardContent className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>
          ) : !edges || edges.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-medium mb-1">No Edges Detected</h3>
                <p className="text-sm text-muted-foreground">Click "Sync Lines" to fetch latest odds and detect cross-platform edges.</p>
              </CardContent>
            </Card>
          ) : (
            edges.map((edge: any) => {
              const rec = recBadge(edge.recommendation);
              return (
                <Card key={edge.id} className={edge.edge_score >= 50 ? 'border-green-500/30' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{edge.away_team} @ {edge.home_team}</CardTitle>
                        <CardDescription className="capitalize">{edge.market_type} • {SPORT_OPTIONS.find(s => s.value === edge.sport)?.label || edge.sport}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={edgeColor(edge.edge_score)}>
                          Edge: {edge.edge_score}
                        </Badge>
                        <Badge variant="outline" className={rec.cls}>{rec.label}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Best</span>
                        <p className="font-bold text-green-400">{edge.best_line} @ {edge.best_platform}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Worst</span>
                        <p className="font-bold text-red-400">{edge.worst_line} @ {edge.worst_platform}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Line Spread</span>
                        <p className="font-bold">{edge.line_spread}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Platforms</span>
                        <p className="font-bold">{(edge.platforms_compared as any[])?.length || 0} compared</p>
                      </div>
                    </div>
                    {edge.platforms_compared && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(edge.platforms_compared as any[]).map((p: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {p.platform}: {p.odds ?? p.spread ?? p.total}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* MARKET TABS */}
        {['moneyline', 'spread', 'total'].map(marketType => (
          <TabsContent key={marketType} value={marketType} className="space-y-4">
            {linesLoading ? (
              <Card><CardContent className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>
            ) : (
              eventGroups
                .filter(g => g.market_type === marketType)
                .map(group => (
                  <Card key={group.key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{group.away_team} @ {group.home_team}</CardTitle>
                      {group.commence_time && (
                        <CardDescription>{format(new Date(group.commence_time), 'MMM d, h:mm a')}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Platform</TableHead>
                            {marketType === 'moneyline' && (
                              <>
                                <TableHead className="text-right">Home</TableHead>
                                <TableHead className="text-right">Away</TableHead>
                              </>
                            )}
                            {marketType === 'spread' && (
                              <>
                                <TableHead className="text-right">Home Spread</TableHead>
                                <TableHead className="text-right">Home Odds</TableHead>
                                <TableHead className="text-right">Away Spread</TableHead>
                                <TableHead className="text-right">Away Odds</TableHead>
                              </>
                            )}
                            {marketType === 'total' && (
                              <>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Over</TableHead>
                                <TableHead className="text-right">Under</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.lines.map((line: any) => (
                            <TableRow key={line.id}>
                              <TableCell className="font-medium capitalize">{line.platform_slug}</TableCell>
                              {marketType === 'moneyline' && (
                                <>
                                  <TableCell className="text-right font-mono">{formatOdds(line.home_odds)}</TableCell>
                                  <TableCell className="text-right font-mono">{formatOdds(line.away_odds)}</TableCell>
                                </>
                              )}
                              {marketType === 'spread' && (
                                <>
                                  <TableCell className="text-right font-mono">{line.spread_home}</TableCell>
                                  <TableCell className="text-right font-mono">{formatOdds(line.spread_home_odds)}</TableCell>
                                  <TableCell className="text-right font-mono">{line.spread_away}</TableCell>
                                  <TableCell className="text-right font-mono">{formatOdds(line.spread_away_odds)}</TableCell>
                                </>
                              )}
                              {marketType === 'total' && (
                                <>
                                  <TableCell className="text-right font-mono">{line.total}</TableCell>
                                  <TableCell className="text-right font-mono text-green-500">{formatOdds(line.total_over_odds)}</TableCell>
                                  <TableCell className="text-right font-mono text-red-400">{formatOdds(line.total_under_odds)}</TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
            )}
            {!linesLoading && eventGroups.filter(g => g.market_type === marketType).length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No {marketType} lines found. Click "Sync Lines" to fetch.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}

        {/* PLATFORMS TAB */}
        <TabsContent value="platforms" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(platforms || []).map((p: any) => {
              const lineCount = lines?.filter((l: any) => l.platform_slug === p.slug).length || 0;
              return (
                <Card key={p.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold">{p.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{p.platform_type}</Badge>
                    </div>
                    <div className="text-2xl font-bold">{lineCount}</div>
                    <div className="text-xs text-muted-foreground">lines today</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
