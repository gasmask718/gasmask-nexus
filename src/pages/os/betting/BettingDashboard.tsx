import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Target, TrendingUp, DollarSign, Brain, BarChart3, Zap, Calculator, AlertTriangle, CheckCircle } from "lucide-react";

export default function BettingDashboard() {
  const stats = [
    { label: "Bankroll", value: "$24,500", icon: DollarSign, change: "+$3,200 MTD", color: "text-emerald-500" },
    { label: "Win Rate", value: "62%", icon: Target, change: "+8% vs avg", color: "text-blue-500" },
    { label: "ROI", value: "+18.4%", icon: TrendingUp, change: "This month", color: "text-purple-500" },
    { label: "Active Bets", value: "12", icon: Zap, change: "$4,800 at risk", color: "text-amber-500" },
  ];

  const aiPredictions = [
    { game: "Lakers vs Warriors", pick: "Lakers -3.5", confidence: 78, edge: "+4.2%", time: "7:30 PM", sport: "NBA" },
    { game: "Chiefs vs Ravens", pick: "Over 47.5", confidence: 72, edge: "+3.1%", time: "1:00 PM Sun", sport: "NFL" },
    { game: "Man City vs Liverpool", pick: "BTTS Yes", confidence: 81, edge: "+5.8%", time: "11:30 AM", sport: "EPL" },
    { game: "Yankees vs Dodgers", pick: "Yankees ML", confidence: 68, edge: "+2.4%", time: "4:00 PM", sport: "MLB" },
    { game: "Djokovic vs Alcaraz", pick: "Over 3.5 Sets", confidence: 74, edge: "+3.5%", time: "9:00 AM", sport: "Tennis" },
  ];

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 75) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (confidence >= 65) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  };

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-amber-950/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            Sports Betting AI OS
          </h1>
          <p className="text-muted-foreground mt-1">AI-Powered Predictions, Edge Detection & Bankroll Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calculator className="h-4 w-4 mr-2" />
            Hedge Calculator
          </Button>
          <Button className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600">
            <Brain className="h-4 w-4 mr-2" />
            AI Analysis
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
                  <p className="text-xs text-emerald-500 mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="predictions" className="space-y-4">
        <TabsList className="bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="predictions">AI Predictions</TabsTrigger>
          <TabsTrigger value="active">Active Bets</TabsTrigger>
          <TabsTrigger value="hedge">Hedge Calculator</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="predictions" className="space-y-4">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-amber-500" />
                Today's AI Picks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiPredictions.map((pred, i) => (
                  <div key={i} className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                          <Trophy className="h-6 w-6 text-amber-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{pred.sport}</Badge>
                            <span className="text-sm text-muted-foreground">{pred.time}</span>
                          </div>
                          <h3 className="font-semibold mt-1">{pred.game}</h3>
                          <p className="text-lg font-bold text-amber-500">{pred.pick}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={getConfidenceBadge(pred.confidence)}>
                          {pred.confidence}% Confidence
                        </Badge>
                        <p className="text-emerald-500 font-semibold mt-2">{pred.edge} Edge</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Active Bets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { game: "Lakers vs Warriors", pick: "Lakers -3.5", stake: "$500", odds: "-110", potential: "$954", status: "Live" },
                  { game: "Chiefs vs Ravens", pick: "Over 47.5", stake: "$400", odds: "-105", potential: "$780", status: "Pending" },
                  { game: "Man City vs Liverpool", pick: "BTTS Yes", stake: "$300", odds: "-125", potential: "$540", status: "Pending" },
                ].map((bet, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium">{bet.game}</p>
                      <p className="text-sm text-muted-foreground">{bet.pick} @ {bet.odds}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Stake</p>
                        <p className="font-semibold">{bet.stake}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">To Win</p>
                        <p className="font-semibold text-emerald-500">{bet.potential}</p>
                      </div>
                      <Badge variant="outline" className={bet.status === 'Live' ? "bg-red-500/10 text-red-600 animate-pulse" : "bg-blue-500/10 text-blue-600"}>
                        {bet.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hedge">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-purple-500" />
                  Hedge Calculator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Original Bet Amount</label>
                    <input type="text" placeholder="$500" className="w-full mt-1 p-3 rounded-lg bg-muted/50 border border-border/50" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Original Odds</label>
                    <input type="text" placeholder="+250" className="w-full mt-1 p-3 rounded-lg bg-muted/50 border border-border/50" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Hedge Odds</label>
                    <input type="text" placeholder="-150" className="w-full mt-1 p-3 rounded-lg bg-muted/50 border border-border/50" />
                  </div>
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-500">
                    Calculate Hedge
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Hedge Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-sm text-muted-foreground">Recommended Hedge Bet</p>
                    <p className="text-3xl font-bold text-emerald-500">$312.50</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <p className="text-sm text-muted-foreground">If Original Wins</p>
                      <p className="text-xl font-bold">+$937.50</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <p className="text-sm text-muted-foreground">If Hedge Wins</p>
                      <p className="text-xl font-bold">+$208.33</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-muted-foreground">Guaranteed Profit</p>
                    <p className="text-2xl font-bold text-amber-500">+$208.33</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Win/Loss Record</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="text-3xl font-bold mt-2">156</p>
                    <p className="text-sm text-muted-foreground">Wins</p>
                  </div>
                  <div className="text-center">
                    <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
                    <p className="text-3xl font-bold mt-2">94</p>
                    <p className="text-sm text-muted-foreground">Losses</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>By Sport</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { sport: "NBA", record: "45-28", pct: "62%" },
                    { sport: "NFL", record: "38-22", pct: "63%" },
                    { sport: "MLB", record: "42-30", pct: "58%" },
                    { sport: "Soccer", record: "31-14", pct: "69%" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="font-medium">{s.sport}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">{s.record}</span>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">{s.pct}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Monthly Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { month: "December", profit: "+$3,200", roi: "+18.4%" },
                    { month: "November", profit: "+$2,850", roi: "+15.2%" },
                    { month: "October", profit: "+$4,100", roi: "+22.1%" },
                    { month: "September", profit: "+$1,950", roi: "+11.8%" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{m.month}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-emerald-500">{m.profit}</span>
                        <Badge variant="outline">{m.roi}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
