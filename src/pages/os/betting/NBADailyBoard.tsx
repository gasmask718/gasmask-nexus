// NBA Daily Board - Auto-generated predictions with SportsDataIO integration
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from 'react-router-dom';
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  Zap, 
  Info, 
  CheckCircle2,
  ChevronLeft,
  Activity,
  Bug,
  ChevronDown,
  EyeOff
} from 'lucide-react';
import { 
  useNBAGamesToday, 
  useTopAIProps, 
  useParlayEligibleProps, 
  usePropsToAvoid,
  useNBAPropsToday,
  useNBARefreshLog,
  useRunNBAPredictions,
  useCopyPropToSimulated,
  NBAProp 
} from '@/hooks/useNBAPredictions';
import { NBAStatsDisplay, StatsDebugPanel, HiddenPropMessage, hasRequiredStats } from '@/components/betting/NBAStatsDisplay';

const NBADailyBoard = () => {
  const [activeTab, setActiveTab] = useState('top-props');
  const [showStatsDebug, setShowStatsDebug] = useState(false);
  const [showHiddenCount, setShowHiddenCount] = useState(true);
  
  const { data: games, isLoading: gamesLoading } = useNBAGamesToday();
  const { data: topProps, isLoading: topLoading } = useTopAIProps(65);
  const { data: parlayProps, isLoading: parlayLoading } = useParlayEligibleProps();
  const { data: avoidProps, isLoading: avoidLoading } = usePropsToAvoid();
  const { data: allProps, isLoading: allLoading } = useNBAPropsToday();
  const { data: refreshLog } = useNBARefreshLog();
  
  const runPredictions = useRunNBAPredictions();
  const copyProp = useCopyPropToSimulated();

  const getConfidenceBadge = (score: number | null) => {
    const s = score ?? 50;
    if (s >= 65) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (s >= 55) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (s >= 45) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-muted text-muted-foreground border-muted";
  };

  const getRecommendationBadge = (rec: string | null) => {
    switch (rec) {
      case 'strong_play': return "bg-emerald-500 text-white";
      case 'lean': return "bg-blue-500 text-white";
      case 'pass': return "bg-muted text-muted-foreground";
      case 'avoid': return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Extract stats from calibration_factors for display consistency
  // CRITICAL: These must match the values used in probability calculations
  const extractStats = (prop: NBAProp) => {
    const factors = prop.calibration_factors as Record<string, any> | null;
    return {
      last5Avg: factors?.last_5_avg ?? null,
      seasonAvg: factors?.season_avg ?? null,
      last5MinutesAvg: factors?.minutes_l5 ?? null,
      injuryStatus: factors?.injury_status ?? 'active',
      defRank: factors?.def_rank ?? null,
      paceRating: factors?.pace_rating ?? null,
      statsSource: factors?.stats_source ?? prop.source ?? null,
      playerId: factors?.player_id ?? prop.player_id ?? null,
      gameId: factors?.game_id ?? null,
      fetchTimestamp: factors?.fetch_timestamp ?? null,
    };
  };

  // Check if prop has valid player identity (not placeholder)
  const isValidPlayer = (prop: NBAProp): boolean => {
    const invalidNames = ['PG Player', 'SG Player', 'SF Player', 'PF Player', 'C Player', 'Unknown Player', 'Unknown'];
    if (invalidNames.some(invalid => prop.player_name?.includes(invalid))) return false;
    if (prop.player_id?.startsWith('mock_')) return false;
    if (prop.source?.includes('Mock')) return false;
    return true;
  };

  // HARD FAIL: Check if prop has all required stats for display
  const propHasRequiredStats = (prop: NBAProp): boolean => {
    const stats = extractStats(prop);
    return hasRequiredStats({
      playerName: prop.player_name,
      team: prop.team,
      opponent: prop.opponent,
      last5Avg: stats.last5Avg,
      seasonAvg: stats.seasonAvg,
      last5MinutesAvg: stats.last5MinutesAvg,
      opponentDefTier: prop.opponent_def_tier,
      paceTier: prop.pace_tier,
      source: stats.statsSource,
    });
  };

  // Filter props with required stats
  const filterValidProps = (props: NBAProp[] | undefined): NBAProp[] => {
    if (!props) return [];
    return props.filter(p => isValidPlayer(p) && propHasRequiredStats(p));
  };

  // Count hidden props
  const countHiddenProps = (props: NBAProp[] | undefined): number => {
    if (!props) return 0;
    return props.filter(p => !isValidPlayer(p) || !propHasRequiredStats(p)).length;
  };

  const PropCard = ({ prop, showAdd = true, forceExpandedStats = false }: { prop: NBAProp; showAdd?: boolean; forceExpandedStats?: boolean }) => {
    const [debugOpen, setDebugOpen] = useState(false);
    const stats = extractStats(prop);
    const validPlayer = isValidPlayer(prop);
    const hasStats = propHasRequiredStats(prop);
    
    // HARD FAIL: Don't render props without valid player or required stats
    if (!validPlayer || !hasStats) {
      return null;
    }
    
    return (
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{prop.player_name}</span>
                <Badge variant="outline" className="text-xs">{prop.team}</Badge>
                <span className="text-xs text-muted-foreground">vs {prop.opponent}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={prop.over_under === 'over' ? 'bg-emerald-500' : 'bg-red-500'}>
                  {prop.over_under?.toUpperCase() || 'OVER'} {prop.line_value}
                </Badge>
                <span className="font-medium">{prop.stat_type}</span>
                <Badge variant="outline" className={getRecommendationBadge(prop.recommendation)}>
                  {prop.recommendation?.replace('_', ' ') || 'pass'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm mb-3">
                <span>Prob: <strong>{((prop.estimated_probability ?? 0) * 100).toFixed(1)}%</strong></span>
                <span className={(prop.edge ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  Edge: <strong>{(prop.edge ?? 0) > 0 ? '+' : ''}{((prop.edge ?? 0) * 100).toFixed(1)}%</strong>
                </span>
                <span>ROI: <strong>{((prop.simulated_roi ?? 0) * 100).toFixed(1)}%</strong></span>
                <Badge variant="outline" className={getConfidenceBadge(prop.confidence_score)}>
                  {prop.confidence_score ?? 50}% conf
                </Badge>
              </div>
              
              {/* Stats Display - MANDATORY: These are the SAME values used in probability calculations */}
              {/* Cannot be collapsed for Top AI Props (forceExpandedStats) */}
              <NBAStatsDisplay
                playerName={prop.player_name}
                team={prop.team}
                opponent={prop.opponent}
                gameDate={prop.game_date}
                last5Avg={stats.last5Avg}
                seasonAvg={stats.seasonAvg}
                last5MinutesAvg={stats.last5MinutesAvg}
                opponentDefTier={prop.opponent_def_tier}
                paceTier={prop.pace_tier}
                injuryStatus={stats.injuryStatus}
                dataCompleteness={prop.data_completeness}
                source={stats.statsSource}
                statType={prop.stat_type}
                forceExpanded={forceExpandedStats}
              />

              {/* Owner Debug Toggle - View Raw Stats Data */}
              {showStatsDebug && (
                <Collapsible open={debugOpen} onOpenChange={setDebugOpen} className="mt-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
                      <Bug className="h-3 w-3 mr-1" />
                      View Raw Stats Data
                      <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <StatsDebugPanel 
                      calibrationFactors={prop.calibration_factors}
                      source={prop.source}
                      dataCompleteness={prop.data_completeness}
                      playerId={stats.playerId}
                      gameId={stats.gameId}
                      fetchTimestamp={stats.fetchTimestamp}
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">Why this prediction:</p>
                    <ul className="text-xs space-y-1">
                      {prop.reasoning?.map((r: string, i: number) => (
                        <li key={i}>• {r}</li>
                      )) || <li>• Analysis based on recent performance</li>}
                    </ul>
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs">
                        <strong>Context:</strong> {prop.opponent_def_tier || 'med'} defense, {prop.pace_tier || 'avg'} pace, mins {prop.minutes_trend || 'flat'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Data completeness: {prop.data_completeness ?? 50}%
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {showAdd && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyProp.mutate(prop)}
                  disabled={copyProp.isPending}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Count hidden props for each category
  const hiddenTopProps = countHiddenProps(topProps);
  const hiddenParlayProps = countHiddenProps(parlayProps);
  const hiddenAvoidProps = countHiddenProps(avoidProps);
  const hiddenAllProps = countHiddenProps(allProps);

  // Get filtered valid props
  const validTopProps = filterValidProps(topProps);
  const validParlayProps = filterValidProps(parlayProps);
  const validAvoidProps = filterValidProps(avoidProps);
  const validAllProps = filterValidProps(allProps);

  const isLoading = gamesLoading || topLoading || parlayLoading || avoidLoading || allLoading;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/os/sports-betting">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">NBA Daily Board</h1>
          </div>
          <p className="text-muted-foreground">
            AI-generated player prop predictions
            {refreshLog && (
              <span className="ml-2 text-xs">
                • Last updated: {refreshLog.completed_at ? new Date(refreshLog.completed_at).toLocaleTimeString() : 'Never'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Stats Debug Toggle (owner-only) */}
          <div className="flex items-center gap-2">
            <Switch 
              id="stats-debug" 
              checked={showStatsDebug} 
              onCheckedChange={setShowStatsDebug}
            />
            <Label htmlFor="stats-debug" className="text-xs text-muted-foreground cursor-pointer">
              <Bug className="h-3 w-3 inline mr-1" />
              Stats Debug
            </Label>
          </div>
          <Button 
            onClick={() => runPredictions.mutate()} 
            disabled={runPredictions.isPending}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${runPredictions.isPending ? 'animate-spin' : ''}`} />
            {runPredictions.isPending ? 'Running...' : 'Run NBA Predictions'}
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      {refreshLog && (
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span>Games: <strong>{refreshLog.games_fetched ?? 0}</strong></span>
                </div>
                <div>Players: <strong>{refreshLog.players_updated ?? 0}</strong></div>
                <div>Props: <strong>{refreshLog.props_generated ?? 0}</strong></div>
              </div>
              <Badge variant="secondary">
                {refreshLog.status === 'complete' ? '✓ Ready' : refreshLog.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Games Today */}
      {games && games.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today's Games ({games.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {games.map((game) => (
                <Badge key={game.id} variant="outline" className="py-1 px-3">
                  {game.away_team} @ {game.home_team}
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(game.game_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Props Tabs - Using filtered valid props counts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="top-props" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Top Props ({validTopProps.length})
          </TabsTrigger>
          <TabsTrigger value="parlay" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Parlay ({validParlayProps.length})
          </TabsTrigger>
          <TabsTrigger value="avoid" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Avoid ({validAvoidProps.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            All ({validAllProps.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="top-props" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Top AI Props (Singles)
              </CardTitle>
              <CardDescription>
                High confidence plays with positive expected ROI. Min 65% confidence. Stats panel always visible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Hidden props warning */}
              {hiddenTopProps > 0 && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    {hiddenTopProps} prop{hiddenTopProps > 1 ? 's' : ''} hidden — insufficient verified stats
                  </span>
                </div>
              )}
              <ScrollArea className="h-[500px]">
                {validTopProps.length === 0 && !isLoading && (
                  <div className="py-8">
                    <HiddenPropMessage reason="no props with complete verified stats" />
                  </div>
                )}
                {validTopProps.map((prop) => (
                  <PropCard key={prop.id} prop={prop} forceExpandedStats={true} />
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parlay" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Parlay-Eligible Props
              </CardTitle>
              <CardDescription>
                Lower volatility props suitable for parlays. One prop per player.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Hidden props warning */}
              {hiddenParlayProps > 0 && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    {hiddenParlayProps} prop{hiddenParlayProps > 1 ? 's' : ''} hidden — insufficient verified stats
                  </span>
                </div>
              )}
              <ScrollArea className="h-[500px]">
                {validParlayProps.length === 0 && !isLoading && (
                  <div className="py-8">
                    <HiddenPropMessage reason="no parlay props with complete verified stats" />
                  </div>
                )}
                {validParlayProps.map((prop) => (
                  <PropCard key={prop.id} prop={prop} />
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avoid" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                Props to Avoid
              </CardTitle>
              <CardDescription>
                High variance or negative edge. Do not play these.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Hidden props warning */}
              {hiddenAvoidProps > 0 && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    {hiddenAvoidProps} prop{hiddenAvoidProps > 1 ? 's' : ''} hidden — insufficient verified stats
                  </span>
                </div>
              )}
              <ScrollArea className="h-[500px]">
                {validAvoidProps.length === 0 && !isLoading && (
                  <div className="py-8">
                    <HiddenPropMessage reason="no avoid props with complete verified stats" />
                  </div>
                )}
                {validAvoidProps.map((prop) => (
                  <PropCard key={prop.id} prop={prop} showAdd={false} />
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All NBA Props Today</CardTitle>
              <CardDescription>
                Complete list of generated props, sorted by confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Hidden props warning */}
              {hiddenAllProps > 0 && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    {hiddenAllProps} prop{hiddenAllProps > 1 ? 's' : ''} hidden — insufficient verified stats
                  </span>
                </div>
              )}
              <ScrollArea className="h-[500px]">
                {validAllProps.length === 0 && !isLoading && (
                  <div className="py-8">
                    <HiddenPropMessage reason="no props with complete verified stats" />
                  </div>
                )}
                {validAllProps.map((prop) => (
                  <PropCard key={prop.id} prop={prop} />
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NBADailyBoard;
