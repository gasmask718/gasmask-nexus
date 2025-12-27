import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Target, TrendingUp, DollarSign, Brain, BarChart3, Zap, Calculator, AlertTriangle, CheckCircle, Play, Loader2, FlaskConical, Shield, Info } from "lucide-react";
import { useSimulatedBets, useSimulationRuns, useTodaysTopProps, useRunSimulation, useAllSimulatedBets } from '@/hooks/useBettingSimulation';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BettingDashboard() {
  // Fetch ALL simulated bets without restrictive filters
  const { data: simulatedBets } = useAllSimulatedBets();
  const { data: simulationRuns } = useSimulationRuns();
  const { data: topProps } = useTodaysTopProps();
  const runSimulation = useRunSimulation();

  // Calculate live stats from ALL data (no filtering)
  const totalSimulated = simulatedBets?.length || 0;
  const avgConfidence = simulatedBets?.length 
    ? Math.round(simulatedBets.reduce((s, b) => s + (b.confidence_score || 0), 0) / simulatedBets.length)
    : 0;
  const avgROI = simulatedBets?.length
    ? (simulatedBets.reduce((s, b) => s + (b.simulated_roi || 0), 0) / simulatedBets.length * 100)
    : 0;
  const strongPlays = simulatedBets?.filter(b => (b.confidence_score || 0) >= 70).length || 0;
  const latestRun = simulationRuns?.[0];

  const stats = [
    { label: "Simulated Bets", value: totalSimulated.toString(), icon: Target, change: "Latest run", color: "text-blue-500" },
    { label: "Avg Confidence", value: `${avgConfidence}%`, icon: Brain, change: "All props", color: "text-purple-500" },
    { label: "Avg Sim ROI", value: `${avgROI >= 0 ? '+' : ''}${avgROI.toFixed(1)}%`, icon: TrendingUp, change: "Expected", color: "text-emerald-500" },
    { label: "Strong Plays", value: strongPlays.toString(), icon: Zap, change: "70%+ confidence", color: "text-amber-500" },
  ];

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 70) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (confidence >= 40) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  };

  const handleRunSimulation = () => {
    runSimulation.mutate({
      market_types: ['player_prop', 'fantasy_prop'],
    });
  };

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-amber-950/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            Sports Betting AI OS
          </h1>
          <p className="text-muted-foreground mt-1">Simulation-First Analytics & Decision Support</p>
        </div>
        <div className="flex gap-2">
          <Link to="/os/sports-betting/line-intake">
            <Button variant="outline">
              <DollarSign className="h-4 w-4 mr-2" />
              Add Lines
            </Button>
          </Link>
          <Link to="/os/sports-betting/parlay-lab">
            <Button variant="outline">
              <FlaskConical className="h-4 w-4 mr-2" />
              Parlay Lab
            </Button>
          </Link>
          <Link to="/os/sports-betting/hedge-center">
            <Button variant="outline">
              <Shield className="h-4 w-4 mr-2" />
              Hedge
            </Button>
          </Link>
          <Button 
            onClick={handleRunSimulation}
            disabled={runSimulation.isPending}
            className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600"
          >
            {runSimulation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Daily Simulation
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 bg-gradient-to-br from-background to-muted/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data visibility indicator */}
      {totalSimulated > 0 && (
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-blue-600">
            Showing all {totalSimulated} simulated bets from latest run{latestRun ? ` (${latestRun.start_date})` : ''} — includes all confidence levels
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs defaultValue="top-props" className="space-y-4">
        <TabsList className="bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="top-props">Top Simulated Props</TabsTrigger>
          <TabsTrigger value="all-sims">All Simulations ({totalSimulated})</TabsTrigger>
          <TabsTrigger value="avoid">Props to Avoid</TabsTrigger>
          <TabsTrigger value="analytics">Quick Analytics</TabsTrigger>
        </TabsList>

        {/* Top Props */}
        <TabsContent value="top-props" className="space-y-4">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Today's Top Simulated Props
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProps && topProps.length > 0 ? (
                <div className="space-y-4">
                  {topProps.map((prop, i) => (
                    <div key={prop.id || i} className="p-4 rounded-lg bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                            <span className="text-xl font-bold text-amber-500">#{i + 1}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{prop.platform}</Badge>
                            </div>
                            <h3 className="font-semibold mt-1">{prop.bet_type || prop.description}</h3>
                            <p className="text-sm text-muted-foreground">
                              {Math.round((prop.estimated_probability || 0) * 100)}% estimated probability
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={getConfidenceBadge(prop.confidence_score || 0)}>
                            {prop.confidence_score}% Confidence
                          </Badge>
                          <p className="text-emerald-500 font-semibold mt-2">
                            +{((prop.simulated_roi || 0) * 100).toFixed(1)}% Sim ROI
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-4">No top props yet</p>
                  <p className="text-sm text-muted-foreground">Add lines and run a simulation to see recommendations</p>
                  <Link to="/os/sports-betting/line-intake">
                    <Button variant="outline" className="mt-4">
                      Add Market Lines
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Simulations */}
        <TabsContent value="all-sims">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                All Simulated Bets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {simulatedBets && simulatedBets.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {simulatedBets.map((bet, i) => (
                    <div key={bet.id || i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {(bet.confidence_score || 0) >= 70 ? (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : (bet.simulated_roi || 0) < 0 ? (
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Target className="h-5 w-5 text-blue-500" />
                        )}
                        <div>
                          <p className="font-medium">{bet.bet_type || bet.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{bet.platform}</Badge>
                            <span className="text-xs text-muted-foreground">{bet.source}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
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
                          {bet.confidence_score}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-4">No simulations yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Props to Avoid */}
        <TabsContent value="avoid">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Props to Avoid (Negative EV)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {simulatedBets && simulatedBets.filter(b => (b.simulated_roi || 0) < 0).length > 0 ? (
                <div className="space-y-3">
                  {simulatedBets
                    .filter(b => (b.simulated_roi || 0) < 0)
                    .sort((a, b) => (a.simulated_roi || 0) - (b.simulated_roi || 0))
                    .slice(0, 10)
                    .map((bet, i) => (
                      <div key={bet.id || i} className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{bet.bet_type || bet.description}</p>
                            <Badge variant="outline" className="mt-1">{bet.platform}</Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-red-500 font-bold">
                              {((bet.simulated_roi || 0) * 100).toFixed(1)}% EV
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {bet.confidence_score}% confidence
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
                  <p className="text-muted-foreground mt-4">No negative EV props found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Analytics */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>By Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['PrizePicks', 'Underdog', 'FanDuel', 'DraftKings'].map(platform => {
                    const platformBets = simulatedBets?.filter(b => b.platform === platform) || [];
                    const avgRoi = platformBets.length 
                      ? platformBets.reduce((s, b) => s + (b.simulated_roi || 0), 0) / platformBets.length
                      : 0;
                    return (
                      <div key={platform} className="flex items-center justify-between">
                        <span className="font-medium">{platform}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{platformBets.length}</span>
                          <Badge variant="outline" className={avgRoi >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}>
                            {(avgRoi * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Confidence Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'High (70+)', filter: (c: number) => c >= 70, color: 'text-emerald-500' },
                    { label: 'Medium (40-69)', filter: (c: number) => c >= 40 && c < 70, color: 'text-blue-500' },
                    { label: 'Low (<40)', filter: (c: number) => c < 40, color: 'text-amber-500' },
                  ].map(bucket => {
                    const count = simulatedBets?.filter(b => bucket.filter(b.confidence_score || 0)).length || 0;
                    const pct = totalSimulated > 0 ? ((count / totalSimulated) * 100).toFixed(0) : 0;
                    return (
                      <div key={bucket.label} className="flex items-center justify-between">
                        <span className={`font-medium ${bucket.color}`}>{bucket.label}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{count}</span>
                          <span className="text-sm">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Recent Runs</CardTitle>
              </CardHeader>
              <CardContent>
                {simulationRuns && simulationRuns.length > 0 ? (
                  <div className="space-y-3">
                    {simulationRuns.slice(0, 5).map((run, i) => (
                      <div key={run.id || i} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{run.start_date}</span>
                        <div className="flex items-center gap-2">
                          <span>{run.total_bets || 0} bets</span>
                          <Badge variant="outline" className={(run.roi || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {((run.roi || 0) * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No runs yet</p>
                )}
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
