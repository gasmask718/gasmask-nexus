import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Trophy, BarChart3, Globe, MessageSquare, Zap, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

const tierColor = (action: string) => {
  if (action === "ELITE BET") return "bg-amber-500/20 text-amber-400 border-amber-500/40";
  if (action === "STRONG BET") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  return "bg-blue-500/20 text-blue-400 border-blue-500/40";
};

const confColor = (c: number) => c >= 80 ? "text-amber-400" : c >= 60 ? "text-emerald-400" : "text-blue-400";

export default function SBOCommandCenter() {
  const [running, setRunning] = useState(false);

  const { data: topPlays, refetch: refetchTop } = useQuery({
    queryKey: ["sbo-top-plays", today()],
    queryFn: async () => {
      const { data } = await supabase
        .from("sbo_top_plays")
        .select("*")
        .eq("game_date", today())
        .order("confidence", { ascending: false });
      return data || [];
    },
  });

  const { data: propsData, refetch: refetchProps } = useQuery({
    queryKey: ["sbo-props-engine", today()],
    queryFn: async () => {
      const { data } = await supabase
        .from("props_master" as any)
        // PHASE 4 / ITEM 1 — schema drift fix: props_master has prediction/confidence_score/odds,
        // NOT ai_recommendation/ai_confidence/over_odds/under_odds. Old select 400'd.
        .select("player_name, stat_type, line, confidence_score, prediction, odds, platform, consensus_score")
        .eq("game_date", today())
        .not("confidence_score", "is", null)
        .gte("confidence_score", 60)
        .order("confidence_score", { ascending: false })
        .limit(20);
      return (data as any[]) || [];
    },
  });

  const { data: polySignals, refetch: refetchPoly } = useQuery({
    queryKey: ["sbo-poly-signals", today()],
    queryFn: async () => {
      const { data } = await supabase
        .from("sbo_odds_comparison" as any)
        .select("*")
        .eq("has_value", true)
        .gte("created_at", `${today()}T00:00:00`)
        .limit(20);
      return (data as any[]) || [];
    },
  });

  const { data: capperPicks, refetch: refetchCappers } = useQuery({
    queryKey: ["sbo-capper-signals", today()],
    queryFn: async () => {
      const { data } = await supabase
        .from("sbo_capper_picks" as any)
        // PHASE 3 / ITEM 9 — schema drift fix: sbo_capper_picks has prop_type + data_source,
        // NOT stat_type/source. The old select 400'd and the panel rendered permanently empty.
        .select("capper_id, player_name, prop_type, direction, line, edge_score, data_source, review_status")
        .eq("game_date", today())
        .eq("review_status", "verified")
        .limit(20);
      return (data as any[]) || [];
    },
  });

  const runPipeline = async () => {
    setRunning(true);
    toast.info("Running full SBO pipeline...");
    try {
      const { error } = await supabase.functions.invoke("sbo-top-plays");
      if (error) throw error;
      toast.success("Top plays generated!");
      refetchTop();
      refetchProps();
      refetchPoly();
      refetchCappers();
    } catch (e: any) {
      toast.error("Pipeline failed: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  const elitePlays = (topPlays || []).filter((p: any) => p.recommended_action === "ELITE BET");
  const strongPlays = (topPlays || []).filter((p: any) => p.recommended_action === "STRONG BET");
  const watchlistPlays = (topPlays || []).filter((p: any) => p.recommended_action === "WATCHLIST");

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            SBO Command Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Multi-engine consensus • {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Button onClick={runPipeline} disabled={running} size="sm" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Running..." : "Run Pipeline"}
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Top Plays", value: (topPlays || []).length, icon: Trophy, color: "text-amber-400" },
          { label: "Elite Bets", value: elitePlays.length, icon: Zap, color: "text-amber-400" },
          { label: "Props Signals", value: (propsData || []).length, icon: BarChart3, color: "text-purple-400" },
          { label: "Poly Signals", value: (polySignals || []).length, icon: Globe, color: "text-cyan-400" },
          { label: "Capper Picks", value: (capperPicks || []).length, icon: MessageSquare, color: "text-orange-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-card/50">
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TOP CONSENSUS PICKS */}
      {(topPlays || []).length > 0 && (
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Trophy className="h-5 w-5" />
              Top AI Consensus Picks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left p-2">Tier</th>
                    <th className="text-left p-2">Player</th>
                    <th className="text-left p-2">Pick</th>
                    <th className="text-left p-2">Confidence</th>
                    <th className="text-left p-2">Engines</th>
                    <th className="text-left p-2">#</th>
                  </tr>
                </thead>
                <tbody>
                  {(topPlays || []).map((play: any, i: number) => (
                    <tr key={play.id || i} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="p-2">
                        <Badge variant="outline" className={tierColor(play.recommended_action)}>
                          {play.recommended_action}
                        </Badge>
                      </td>
                      <td className="p-2 font-medium">{play.player_name || "Market"}</td>
                      <td className="p-2">{play.pick}</td>
                      <td className={`p-2 font-bold ${confColor(play.confidence || 0)}`}>
                        {play.confidence}%
                      </td>
                      <td className="p-2 text-xs">{(play.engines_agreed || []).join(", ")}</td>
                      <td className="p-2">{play.engine_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Three-panel engine view */}
      <Tabs defaultValue="props" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="props" className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Props Engine
          </TabsTrigger>
          <TabsTrigger value="polymarket" className="gap-1">
            <Globe className="h-3.5 w-3.5" /> Polymarket
          </TabsTrigger>
          <TabsTrigger value="cappers" className="gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> Cappers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="props">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-purple-400 flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" /> Props Engine — AI Predictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(propsData || []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No props data for today yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/50">
                        <th className="text-left p-2">Player</th>
                        <th className="text-left p-2">Prop</th>
                        <th className="text-left p-2">Line</th>
                        <th className="text-left p-2">Pick</th>
                        <th className="text-left p-2">AI Conf</th>
                        <th className="text-left p-2">Platform</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(propsData || []).map((p: any, i: number) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                          <td className="p-2 font-medium">{p.player_name}</td>
                          <td className="p-2">{p.stat_type}</td>
                          <td className="p-2">{p.line}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={
                              String(p.prediction).toUpperCase() === "OVER" ? "text-emerald-400 border-emerald-500/40" : "text-red-400 border-red-500/40"
                            }>
                              {p.prediction ?? "—"}
                            </Badge>
                          </td>
                          <td className={`p-2 font-bold ${confColor(Number(p.confidence_score) || 0)}`}>{p.confidence_score}%</td>
                          <td className="p-2 text-xs text-muted-foreground">{p.platform}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="polymarket">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-cyan-400 flex items-center gap-2 text-base">
                <Globe className="h-4 w-4" /> Polymarket Value Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(polySignals || []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No Polymarket value signals detected today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/50">
                        <th className="text-left p-2">Market</th>
                        <th className="text-left p-2">Edge</th>
                        <th className="text-left p-2">Poly Odds</th>
                        <th className="text-left p-2">Book Odds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(polySignals || []).map((s: any, i: number) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                          <td className="p-2 font-medium">{s.description || s.market_slug}</td>
                          <td className="p-2 text-emerald-400 font-bold">{((s.implied_edge || 0) * 100).toFixed(1)}%</td>
                          <td className="p-2">{s.polymarket_odds || "-"}</td>
                          <td className="p-2">{s.sportsbook_odds || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cappers">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-orange-400 flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> Verified Capper Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(capperPicks || []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No verified capper picks for today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/50">
                        <th className="text-left p-2">Player</th>
                        <th className="text-left p-2">Pick</th>
                        <th className="text-left p-2">Direction</th>
                        <th className="text-left p-2">Edge</th>
                        <th className="text-left p-2">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(capperPicks || []).map((c: any, i: number) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                          <td className="p-2 font-medium">{c.player_name || "-"}</td>
                          <td className="p-2">{c.prop_type} {c.line}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={
                              c.direction === "OVER" ? "text-emerald-400 border-emerald-500/40" : "text-red-400 border-red-500/40"
                            }>
                              {c.direction}
                            </Badge>
                          </td>
                          <td className="p-2">{c.edge_score || "-"}</td>
                          <td className="p-2 text-xs text-muted-foreground">{c.data_source || "manual"}</td>
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
