import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, BarChart3, TrendingUp, Target, Brain, AlertTriangle, CheckCircle, Clock, Zap } from "lucide-react";
import { useSimulationRuns, useSimulatedBets, useRunSimulation, useTodaysTopProps } from '@/hooks/useBettingSimulation';

export default function SimulationPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const { data: simulationRuns, isLoading: runsLoading } = useSimulationRuns();
  const { data: simulatedBets, isLoading: betsLoading } = useSimulatedBets('simulated');
  const { data: topProps } = useTodaysTopProps();
  const runSimulation = useRunSimulation();

  const handleRunSimulation = () => {
    runSimulation.mutate({
      platforms: selectedPlatform === 'all' ? undefined : [selectedPlatform],
      market_types: ['player_prop', 'fantasy_prop'],
    });
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 85) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (score >= 70) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (score >= 55) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-muted text-muted-foreground border-muted";
  };

  const getVolatilityBadge = (vol: string) => {
    if (vol === 'low') return "bg-emerald-500/10 text-emerald-600";
    if (vol === 'high') return "bg-red-500/10 text-red-600";
    return "bg-amber-500/10 text-amber-600";
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'strong_play': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'lean': return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'pass': return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'avoid': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  // Calculate summary stats
  const totalBets = simulatedBets?.length || 0;
  const avgConfidence = simulatedBets?.length 
    ? Math.round(simulatedBets.reduce((s, b) => s + (b.confidence_score || 0), 0) / simulatedBets.length)
    : 0;
  const avgROI = simulatedBets?.length
    ? (simulatedBets.reduce((s, b) => s + (b.simulated_roi || 0), 0) / simulatedBets.length * 100).toFixed(1)
    : '0.0';
  const strongPlays = simulatedBets?.filter(b => (b.confidence_score || 0) >= 70).length || 0;

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-blue-950/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Simulation Center</h1>
          <p className="text-muted-foreground">AI-powered prop simulation & analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="FanDuel">FanDuel</SelectItem>
              <SelectItem value="DraftKings">DraftKings</SelectItem>
              <SelectItem value="PrizePicks">PrizePicks</SelectItem>
              <SelectItem value="Underdog">Underdog</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleRunSimulation}
            disabled={runSimulation.isPending}
            className="bg-gradient-to-r from-blue-600 to-cyan-500"
          >
            <Play className="h-4 w-4 mr-2" />
            {runSimulation.isPending ? 'Running...' : 'Run Daily Simulation'}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Simulated</p>
                <p className="text-2xl font-bold">{totalBets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Brain className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold">{avgConfidence}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Simulated ROI</p>
                <p className="text-2xl font-bold">{avgROI}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Strong Plays</p>
                <p className="text-2xl font-bold">{strongPlays}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="props" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="props">Simulated Props</TabsTrigger>
          <TabsTrigger value="top">Top Plays Today</TabsTrigger>
          <TabsTrigger value="runs">Simulation History</TabsTrigger>
          <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
        </TabsList>

        {/* Simulated Props */}
        <TabsContent value="props" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                All Simulated Props
              </CardTitle>
            </CardHeader>
            <CardContent>
              {betsLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading simulations...</p>
              ) : simulatedBets && simulatedBets.length > 0 ? (
                <div className="space-y-3">
                  {simulatedBets.map((bet, i) => (
                    <div key={bet.id || i} className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getRecommendationIcon(bet.confidence_score >= 70 ? 'strong_play' : bet.confidence_score >= 40 ? 'lean' : 'pass')}
                          <div>
                            <p className="font-medium">{bet.bet_type || bet.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{bet.platform}</Badge>
                              <span className="text-xs text-muted-foreground">{bet.source}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Probability</p>
                            <p className="font-semibold">{Math.round((bet.estimated_probability || 0) * 100)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Sim ROI</p>
                            <p className={`font-semibold ${(bet.simulated_roi || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {((bet.simulated_roi || 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                          <Badge variant="outline" className={getConfidenceBadge(bet.confidence_score || 0)}>
                            {bet.confidence_score}% conf
                          </Badge>
                          <Badge variant="outline" className={getVolatilityBadge(String(bet.volatility_score ?? 'medium'))}>
                            {bet.volatility_score ?? 'medium'} vol
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-4">No simulated props yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Add market lines and run a simulation</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Plays */}
        <TabsContent value="top" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Top Simulated Props Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProps && topProps.length > 0 ? (
                <div className="space-y-3">
                  {topProps.map((prop, i) => (
                    <div key={prop.id || i} className="p-4 rounded-lg bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                            #{i + 1}
                          </div>
                          <div>
                            <p className="font-semibold">{prop.bet_type || prop.description}</p>
                            <Badge variant="outline" className="mt-1">{prop.platform}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-amber-500">{prop.confidence_score}%</p>
                            <p className="text-xs text-muted-foreground">confidence</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xl font-bold text-emerald-500">
                              +{((prop.simulated_roi || 0) * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">sim ROI</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-4">No top plays yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Run today's simulation to find top props</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Simulation History */}
        <TabsContent value="runs" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                Simulation Run History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : simulationRuns && simulationRuns.length > 0 ? (
                <div className="space-y-3">
                  {simulationRuns.map((run, i) => (
                    <div key={run.id || i} className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {run.start_date} {run.start_date !== run.end_date && `to ${run.end_date}`}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {run.total_bets || 0} bets
                            </Badge>
                            {Array.isArray(run.platforms_included) && run.platforms_included.map((p: string, j: number) => (
                              <Badge key={j} variant="outline" className="text-xs">{p}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${(run.roi || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {((run.roi || 0) * 100).toFixed(1)}% ROI
                          </p>
                          {run.drawdown && (
                            <p className="text-sm text-muted-foreground">
                              Max DD: {(run.drawdown * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-4">No simulation runs yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Performance by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['PrizePicks', 'Underdog', 'FanDuel', 'DraftKings'].map(platform => {
                    const platformBets = simulatedBets?.filter(b => b.platform === platform) || [];
                    const avgRoi = platformBets.length 
                      ? platformBets.reduce((s, b) => s + (b.simulated_roi || 0), 0) / platformBets.length
                      : 0;
                    return (
                      <div key={platform} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <span className="font-medium">{platform}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{platformBets.length} props</span>
                          <Badge variant="outline" className={avgRoi >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {(avgRoi * 100).toFixed(1)}% ROI
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Performance by Confidence Bucket</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'High (70-100)', min: 70, max: 100 },
                    { label: 'Medium (40-69)', min: 40, max: 69 },
                    { label: 'Low (0-39)', min: 0, max: 39 },
                  ].map((bucket) => {
                    const bucketBets = simulatedBets?.filter(
                      b => (b.confidence_score ?? 0) >= bucket.min && (b.confidence_score ?? 0) <= bucket.max
                    ) || [];
                    const avgRoi = bucketBets.length
                      ? bucketBets.reduce((s, b) => s + (b.simulated_roi || 0), 0) / bucketBets.length
                      : 0;
                    return (
                      <div key={bucket.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <span className="font-medium">{bucket.label}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{bucketBets.length} props</span>
                          <Badge variant="outline" className={avgRoi >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {(avgRoi * 100).toFixed(1)}% ROI
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Disclaimer */}
      <p className="text-xs text-center text-muted-foreground mt-8">
        For informational and entertainment purposes only. Not a sportsbook.
      </p>
    </div>
  );
}
