// NBA Daily Board - Auto-generated predictions
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Target, Zap, Info, CheckCircle2 } from 'lucide-react';
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

const NBADailyBoard = () => {
  const [activeTab, setActiveTab] = useState('top-props');
  
  const { data: games, isLoading: gamesLoading } = useNBAGamesToday();
  const { data: topProps, isLoading: topLoading } = useTopAIProps(65);
  const { data: parlayProps, isLoading: parlayLoading } = useParlayEligibleProps();
  const { data: avoidProps, isLoading: avoidLoading } = usePropsToAvoid();
  const { data: allProps, isLoading: allLoading } = useNBAPropsToday();
  const { data: refreshLog } = useNBARefreshLog();
  
  const runPredictions = useRunNBAPredictions();
  const copyProp = useCopyPropToSimulated();

  const getConfidenceBadge = (score: number) => {
    if (score >= 85) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (score >= 70) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (score >= 55) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-muted text-muted-foreground border-muted";
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'strong_play': return "bg-emerald-500 text-white";
      case 'lean': return "bg-blue-500 text-white";
      case 'pass': return "bg-muted text-muted-foreground";
      case 'avoid': return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const PropCard = ({ prop, showAdd = true }: { prop: NBAProp; showAdd?: boolean }) => (
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
                {prop.over_under.toUpperCase()} {prop.line_value}
              </Badge>
              <span className="font-medium">{prop.stat_type}</span>
              <Badge variant="outline" className={getRecommendationBadge(prop.recommendation)}>
                {prop.recommendation.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>Prob: <strong>{(prop.estimated_probability * 100).toFixed(1)}%</strong></span>
              <span className={prop.edge >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                Edge: <strong>{prop.edge > 0 ? '+' : ''}{prop.edge.toFixed(1)}%</strong>
              </span>
              <span>ROI: <strong>{(prop.simulated_roi * 100).toFixed(1)}%</strong></span>
              <Badge variant="outline" className={getConfidenceBadge(prop.confidence_score)}>
                {prop.confidence_score}% conf
              </Badge>
            </div>
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
                    {prop.reasoning?.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                  <p className="text-xs mt-2 text-muted-foreground">
                    Data completeness: {prop.data_completeness}%
                  </p>
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

  const isLoading = gamesLoading || topLoading || parlayLoading || avoidLoading || allLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">NBA Daily Board</h1>
          <p className="text-muted-foreground">
            AI-generated player prop predictions
            {refreshLog?.completed_at && (
              <span className="ml-2 text-xs">
                Last updated: {new Date(refreshLog.completed_at).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button 
          onClick={() => runPredictions.mutate()} 
          disabled={runPredictions.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${runPredictions.isPending ? 'animate-spin' : ''}`} />
          {runPredictions.isPending ? 'Running...' : 'Run NBA Predictions'}
        </Button>
      </div>

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

      {/* Props Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="top-props" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Top Props ({topProps?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="parlay" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Parlay ({parlayProps?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="avoid" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Avoid ({avoidProps?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            All ({allProps?.length || 0})
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
                High confidence plays with positive expected ROI. Min 65% confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {topProps?.length === 0 && !isLoading && (
                  <p className="text-muted-foreground text-center py-8">
                    No top props found. Run predictions to generate.
                  </p>
                )}
                {topProps?.map((prop) => <PropCard key={prop.id} prop={prop} />)}
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
              <ScrollArea className="h-[500px]">
                {parlayProps?.length === 0 && !isLoading && (
                  <p className="text-muted-foreground text-center py-8">
                    No parlay-eligible props found. Run predictions to generate.
                  </p>
                )}
                {parlayProps?.map((prop) => <PropCard key={prop.id} prop={prop} />)}
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
              <ScrollArea className="h-[500px]">
                {avoidProps?.length === 0 && !isLoading && (
                  <p className="text-muted-foreground text-center py-8">
                    No props to avoid found. Run predictions to generate.
                  </p>
                )}
                {avoidProps?.map((prop) => <PropCard key={prop.id} prop={prop} showAdd={false} />)}
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
              <ScrollArea className="h-[500px]">
                {allProps?.length === 0 && !isLoading && (
                  <p className="text-muted-foreground text-center py-8">
                    No props found. Run predictions to generate.
                  </p>
                )}
                {allProps?.map((prop) => <PropCard key={prop.id} prop={prop} />)}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NBADailyBoard;