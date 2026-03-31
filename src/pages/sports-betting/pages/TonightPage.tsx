import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw, Trophy, BarChart3, Globe, MessageSquare, Zap,
  TrendingUp, Shield, ChevronRight, Activity, Target, X,
  CheckCircle, Clock, Filter, Loader2, AlertTriangle,
  Bell, User, Wifi, WifiOff
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ── Helpers ──────────────────────────────────────────────────────────────────
const todayEST = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const dateDisplay = () => new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" });

const tierConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  "ELITE BET": { label: "ELITE", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  "STRONG BET": { label: "STRONG", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  WATCHLIST: { label: "WATCH", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
};
const getTier = (action: string) => tierConfig[action] || tierConfig.WATCHLIST;

const confLevel = (c: number) => {
  if (c >= 80) return { label: "High", color: "text-amber-400", bar: "bg-amber-500" };
  if (c >= 60) return { label: "Medium", color: "text-emerald-400", bar: "bg-emerald-500" };
  return { label: "Low", color: "text-blue-400", bar: "bg-blue-500" };
};

const engineMeta: Record<string, { icon: typeof BarChart3; color: string; label: string }> = {
  props: { icon: BarChart3, color: "text-purple-400", label: "Props Engine" },
  polymarket: { icon: Globe, color: "text-cyan-400", label: "Polymarket" },
  cappers: { icon: MessageSquare, color: "text-orange-400", label: "Capper Signals" },
  ai: { icon: Zap, color: "text-amber-400", label: "AI Analysis" },
};

const resolveEngine = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("prop")) return "props";
  if (n.includes("poly")) return "polymarket";
  if (n.includes("capper") || n.includes("telegram")) return "cappers";
  return "ai";
};

// ── Main ─────────────────────────────────────────────────────────────────────
export default function TonightPage() {
  const [running, setRunning] = useState(false);
  const [selectedPlay, setSelectedPlay] = useState<any | null>(null);
  const [confFilter, setConfFilter] = useState("all");
  const [engineFilter, setEngineFilter] = useState("all");
  const [activeNav, setActiveNav] = useState("dashboard");

  // ── Data Queries ──────────────────────────────────────────────────────────
  const { data: topPlays = [], refetch: refetchTop } = useQuery({
    queryKey: ["sbo-top-plays", todayEST()],
    queryFn: async () => {
      const { data } = await supabase.from("sbo_top_plays").select("*").eq("game_date", todayEST()).order("confidence", { ascending: false });
      return data || [];
    },
  });

  const { data: propsData = [], refetch: refetchProps } = useQuery({
    queryKey: ["sbo-props-engine", todayEST()],
    queryFn: async () => {
      const { data } = await (supabase as any).from("props_master")
        .select("player_name, stat_type, line, ai_confidence, ai_recommendation, over_odds, under_odds, platform, consensus_score")
        .eq("game_date", todayEST()).not("ai_confidence", "is", null).gte("ai_confidence", 50)
        .order("ai_confidence", { ascending: false }).limit(30);
      return (data as any[]) || [];
    },
  });

  const { data: polySignals = [], refetch: refetchPoly } = useQuery({
    queryKey: ["sbo-poly-signals", todayEST()],
    queryFn: async () => {
      const { data } = await (supabase as any).from("sbo_odds_comparison")
        .select("*").eq("has_value", true).gte("created_at", `${todayEST()}T00:00:00`).limit(30);
      return (data as any[]) || [];
    },
  });

  const { data: capperPicks = [], refetch: refetchCappers } = useQuery({
    queryKey: ["sbo-capper-signals", todayEST()],
    queryFn: async () => {
      const { data } = await (supabase as any).from("sbo_capper_picks")
        .select("capper_id, player_name, stat_type, direction, line, edge_score, source, review_status")
        .eq("game_date", todayEST()).eq("review_status", "verified").limit(30);
      return (data as any[]) || [];
    },
  });

  const { data: games = [], refetch: refetchGames } = useQuery({
    queryKey: ["sbo-tonight-games", todayEST()],
    queryFn: async () => {
      const tomorrowEST = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const { data } = await supabase.from("sbo_games").select("id, external_id, away_team, home_team, game_date, status, sbo_odds(*)")
        .gte("game_date", `${todayEST()}T00:00:00+00:00`).lte("game_date", `${tomorrowEST}T05:00:00+00:00`)
        .order("game_date", { ascending: true });
      return data || [];
    },
  });

  // ── Pipeline ──────────────────────────────────────────────────────────────
  const runPipeline = async () => {
    setRunning(true);
    toast.info("Running full intelligence pipeline...");
    try {
      await supabase.functions.invoke("sbo-top-plays");
      toast.success("Pipeline complete — intelligence updated!");
      refetchTop(); refetchProps(); refetchPoly(); refetchCappers(); refetchGames();
    } catch (e: any) {
      toast.error("Pipeline failed: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  // ── Filters ───────────────────────────────────────────────────────────────
  const filteredPlays = useMemo(() => {
    let plays = topPlays;
    if (confFilter === "high") plays = plays.filter((p: any) => (p.confidence || 0) >= 80);
    else if (confFilter === "medium") plays = plays.filter((p: any) => (p.confidence || 0) >= 60 && (p.confidence || 0) < 80);
    else if (confFilter === "low") plays = plays.filter((p: any) => (p.confidence || 0) < 60);
    if (engineFilter !== "all") plays = plays.filter((p: any) => (p.engines_agreed || []).some((e: string) => e.toLowerCase().includes(engineFilter)));
    return plays;
  }, [topPlays, confFilter, engineFilter]);

  const eliteCount = topPlays.filter((p: any) => p.recommended_action === "ELITE BET").length;
  const strongCount = topPlays.filter((p: any) => p.recommended_action === "STRONG BET").length;

  const engineStatus = [
    { name: "Props Engine", active: propsData.length > 0, icon: BarChart3, color: "text-purple-400" },
    { name: "Polymarket", active: polySignals.length > 0, icon: Globe, color: "text-cyan-400" },
    { name: "Capper Feed", active: capperPicks.length > 0, icon: MessageSquare, color: "text-orange-400" },
    { name: "Consensus AI", active: topPlays.length > 0, icon: Zap, color: "text-amber-400" },
  ];

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "signals", label: "Signals" },
    { id: "engines", label: "Engines" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background text-foreground">

        {/* ═══ TOP NAV BAR ═══ */}
        <div className="border-b border-border/40 bg-card/20 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-[1600px] mx-auto px-4 md:px-6">
            <div className="flex items-center justify-between h-14">
              {/* Left: Logo + Nav */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="font-bold text-sm tracking-tight hidden sm:block">SBO Intelligence</span>
                </div>

                <nav className="hidden md:flex items-center gap-1">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveNav(item.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        activeNav === item.id
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Right: Status + Actions */}
              <div className="flex items-center gap-3">
                {/* Engine status dots */}
                <div className="hidden lg:flex items-center gap-1.5 mr-2">
                  {engineStatus.map((e) => (
                    <Tooltip key={e.name}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30 border border-border/30">
                          <div className={`h-1.5 w-1.5 rounded-full ${e.active ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"}`} />
                          <e.icon className={`h-3 w-3 ${e.color}`} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-[10px]">
                        {e.name}: {e.active ? "🟢 Running" : "⚪ Idle"}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                <Button onClick={runPipeline} disabled={running} size="sm" className="gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 h-8 text-xs">
                  <RefreshCw className={`h-3 w-3 ${running ? "animate-spin" : ""}`} />
                  {running ? "Running..." : "Run Pipeline"}
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="h-8 w-8 rounded-md bg-muted/30 border border-border/30 flex items-center justify-center hover:bg-muted/50 transition-colors">
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px]">Notifications</TooltipContent>
                </Tooltip>

                <div className="h-8 w-8 rounded-full bg-muted/50 border border-border/40 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-5 space-y-5">
          {/* ═══ DATE HEADER ═══ */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Today's Intelligence</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{dateDisplay()} • {games.length} games on slate</p>
            </div>
          </div>

          {/* ═══ KPI STRIP ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Plays", value: topPlays.length, icon: Target, color: "text-foreground" },
              { label: "Elite Bets", value: eliteCount, icon: Zap, color: "text-amber-400" },
              { label: "Strong Bets", value: strongCount, icon: TrendingUp, color: "text-emerald-400" },
              { label: "Engines Live", value: engineStatus.filter(e => e.active).length, icon: Activity, color: "text-cyan-400", suffix: `/${engineStatus.length}` },
              { label: "Avg Confidence", value: topPlays.length > 0 ? Math.round(topPlays.reduce((s: number, p: any) => s + (p.confidence || 0), 0) / topPlays.length) : 0, icon: Shield, color: "text-purple-400", suffix: "%" },
            ].map((s) => (
              <Card key={s.label} className="bg-card/30 border-border/30 hover:border-border/50 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{s.label}</span>
                    <s.icon className={`h-3.5 w-3.5 ${s.color} opacity-50`} />
                  </div>
                  <div className={`text-2xl font-bold tabular-nums ${s.color}`}>
                    {s.value}{(s as any).suffix || ""}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ═══ FILTERS ═══ */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={confFilter} onValueChange={setConfFilter}>
              <SelectTrigger className="w-[130px] h-7 text-[11px] bg-card/30 border-border/30">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="high">🔥 High (80+)</SelectItem>
                <SelectItem value="medium">⚠️ Medium (60-79)</SelectItem>
                <SelectItem value="low">❄️ Low (&lt;60)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={engineFilter} onValueChange={setEngineFilter}>
              <SelectTrigger className="w-[130px] h-7 text-[11px] bg-card/30 border-border/30">
                <SelectValue placeholder="Engine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Engines</SelectItem>
                <SelectItem value="props">📊 Props</SelectItem>
                <SelectItem value="poly">💰 Polymarket</SelectItem>
                <SelectItem value="capper">📢 Cappers</SelectItem>
              </SelectContent>
            </Select>
            {(confFilter !== "all" || engineFilter !== "all") && (
              <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={() => { setConfFilter("all"); setEngineFilter("all"); }}>
                Clear
              </Button>
            )}
          </div>

          {/* ═══ SECTION 1: TOP AI CONSENSUS PICKS (Hero) ═══ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-amber-400" />
              <h2 className="text-base font-semibold">Top AI Consensus Picks</h2>
              <Badge variant="outline" className="text-[10px] border-amber-500/20 text-amber-400">{filteredPlays.length}</Badge>
            </div>

            {filteredPlays.length === 0 ? (
              <Card className="border-dashed border-border/30 bg-card/10">
                <CardContent className="py-14 text-center">
                  <Trophy className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No consensus picks yet today</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">Run the pipeline to generate AI picks</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPlays.map((play: any, i: number) => {
                  const tier = getTier(play.recommended_action);
                  const conf = confLevel(play.confidence || 0);
                  const engines = play.engines_agreed || [];
                  return (
                    <motion.div key={play.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <Card
                        className={`cursor-pointer group transition-all duration-200 hover:shadow-xl hover:scale-[1.015] ${tier.bg} ${tier.border}`}
                        onClick={() => setSelectedPlay(play)}
                      >
                        <CardContent className="p-4">
                          {/* Top row */}
                          <div className="flex items-center justify-between mb-2.5">
                            <Badge variant="outline" className={`text-[9px] font-black tracking-[0.15em] ${tier.text} ${tier.border}`}>
                              {tier.label}
                            </Badge>
                            <span className={`text-xl font-bold tabular-nums ${conf.color}`}>{play.confidence}%</span>
                          </div>

                          {/* Player & Pick */}
                          <p className="text-sm font-semibold leading-tight mb-0.5">{play.player_name || "Market Play"}</p>
                          <p className="text-xs text-muted-foreground mb-3">{play.pick}</p>

                          {/* Confidence bar */}
                          <Progress value={play.confidence || 0} className="h-1 mb-3 bg-muted/40" />

                          {/* Engine icons */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {engines.map((eng: string, ei: number) => {
                                const key = resolveEngine(eng);
                                const meta = engineMeta[key] || engineMeta.ai;
                                return (
                                  <Tooltip key={ei}>
                                    <TooltipTrigger asChild>
                                      <div className="h-6 w-6 rounded border border-border/30 flex items-center justify-center bg-muted/20">
                                        <meta.icon className={`h-3 w-3 ${meta.color}`} />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px]">{meta.label}</TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-0.5">
                              {play.engine_count} engines <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ═══ SECTION 2: AI ENGINE RESULTS (3 Columns) ═══ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-semibold">AI Engine Signals</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* ── Panel 1: Props Engine ── */}
              <EnginePanel
                title="Props Engine"
                subtitle="AI statistical predictions"
                icon={BarChart3}
                iconColor="text-purple-400"
                iconBg="bg-purple-500/10 border-purple-500/20"
                count={propsData.length}
                emptyLabel="No props signals"
              >
                {propsData.map((p: any, i: number) => {
                  const c = confLevel(p.ai_confidence || 0);
                  const edge = p.consensus_score ? `+${p.consensus_score}%` : null;
                  return (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{p.player_name}</span>
                        <Badge variant="outline" className={`text-[9px] ${p.ai_recommendation === "OVER" ? "text-emerald-400 border-emerald-500/20" : "text-red-400 border-red-500/20"}`}>
                          {p.ai_recommendation}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                        <span>{p.stat_type} • Line {p.line}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`font-semibold cursor-help ${c.color}`}>{p.ai_confidence}%</span>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px] max-w-[200px]">AI model confidence score based on statistical analysis</TooltipContent>
                        </Tooltip>
                      </div>
                      <Progress value={p.ai_confidence || 0} className="h-1 bg-muted/30" />
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground/60">
                        <span>{p.platform}</span>
                        {edge && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-emerald-400 font-medium cursor-help">Edge {edge}</span>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px] max-w-[200px]">The percentage difference between sportsbook odds and AI predicted probability</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </EnginePanel>

              {/* ── Panel 2: Polymarket ── */}
              <EnginePanel
                title="Polymarket Signals"
                subtitle="Smart money activity"
                icon={Globe}
                iconColor="text-cyan-400"
                iconBg="bg-cyan-500/10 border-cyan-500/20"
                count={polySignals.length}
                emptyLabel="No value signals"
              >
                {polySignals.map((s: any, i: number) => {
                  const edge = (s.implied_edge || 0) * 100;
                  const isSharp = edge >= 10;
                  return (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/40 transition-colors">
                      <p className="text-xs font-semibold mb-1.5 leading-tight">{s.description || s.market_slug}</p>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground cursor-help">Edge</span>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px] max-w-[200px]">Implied edge between Polymarket probability and sportsbook odds</TooltipContent>
                        </Tooltip>
                        <span className="text-emerald-400 font-bold">+{edge.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                        <span>Poly: {s.polymarket_odds || "-"}</span>
                        <span>Book: {s.sportsbook_odds || "-"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${isSharp ? "bg-emerald-400" : "bg-amber-400"}`} />
                        <span className="text-[10px] text-muted-foreground">{isSharp ? "🟢 Smart Money" : "🟡 Moderate"}</span>
                      </div>
                    </div>
                  );
                })}
              </EnginePanel>

              {/* ── Panel 3: Capper Signals ── */}
              <EnginePanel
                title="Capper Signals"
                subtitle="Telegram verified picks"
                icon={MessageSquare}
                iconColor="text-orange-400"
                iconBg="bg-orange-500/10 border-orange-500/20"
                count={capperPicks.length}
                emptyLabel="No capper picks"
              >
                {capperPicks.map((c: any, i: number) => (
                  <div key={i} className="p-2.5 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{c.player_name || "Market"}</span>
                      <Badge variant="outline" className={`text-[9px] ${c.direction === "OVER" ? "text-emerald-400 border-emerald-500/20" : "text-red-400 border-red-500/20"}`}>
                        {c.direction}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mb-1">{c.stat_type} {c.line}</div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground/60">{c.capper_id || "Unknown"}</span>
                      {c.edge_score && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-emerald-400 font-medium cursor-help">Edge: {c.edge_score}</span>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px]">Capper's historical edge score</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground/40 mt-0.5">{c.source || "Telegram"}</div>
                  </div>
                ))}
              </EnginePanel>
            </div>
          </section>

          {/* ═══ AUTOMATION PIPELINE STATUS ═══ */}
          <Card className="bg-card/20 border-border/20">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-5 overflow-x-auto text-xs">
                {[
                  { label: "Data Collection", done: games.length > 0 },
                  { label: "AI Analysis", done: propsData.length > 0 },
                  { label: "Consensus Detection", done: topPlays.length > 0 },
                  { label: "Daily Report", done: false },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-2 whitespace-nowrap">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center ${step.done ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "bg-muted/30 text-muted-foreground/50 border border-border/20"}`}>
                      {step.done ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    </div>
                    <span className={step.done ? "text-foreground" : "text-muted-foreground/60"}>{step.label}</span>
                    {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/25" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ═══ ENGINE HEALTH ═══ */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Real-Time Engine Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {engineStatus.map((e) => (
                <div key={e.name} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card/20 border border-border/20">
                  <e.icon className={`h-4 w-4 ${e.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{e.name}</p>
                    <p className={`text-[10px] ${e.active ? "text-emerald-400" : "text-muted-foreground/50"}`}>
                      {e.active ? "🟢 Running" : "⚪ Idle"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ═══ DETAIL SLIDE-OVER PANEL ═══ */}
        <AnimatePresence>
          {selectedPlay && (
            <>
              <motion.div className="fixed inset-0 bg-black/60 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPlay(null)} />
              <motion.div
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-50 overflow-y-auto"
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              >
                <DetailPanel play={selectedPlay} onClose={() => setSelectedPlay(null)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

// ── Reusable Engine Panel ────────────────────────────────────────────────────
function EnginePanel({ title, subtitle, icon: Icon, iconColor, iconBg, count, emptyLabel, children }: {
  title: string; subtitle: string; icon: any; iconColor: string; iconBg: string; count: number; emptyLabel: string; children: React.ReactNode;
}) {
  return (
    <Card className="bg-card/30 border-border/30">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className={`h-6 w-6 rounded-md border flex items-center justify-center ${iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block">{title}</span>
            <span className="block text-[10px] text-muted-foreground font-normal">{subtitle}</span>
          </div>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="h-[340px]">
          {count === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30">
              <AlertTriangle className="h-6 w-6 mb-2" />
              <p className="text-xs">{emptyLabel}</p>
            </div>
          ) : (
            <div className="space-y-2">{children}</div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ play, onClose }: { play: any; onClose: () => void }) {
  const tier = getTier(play.recommended_action);
  const conf = confLevel(play.confidence || 0);
  const engines = play.engines_agreed || [];

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Badge variant="outline" className={`text-[9px] font-black tracking-[0.15em] mb-2 ${tier.text} ${tier.border}`}>{tier.label}</Badge>
          <h3 className="text-lg font-bold">{play.player_name || "Market Play"}</h3>
          <p className="text-sm text-muted-foreground">{play.pick}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <Separator className="bg-border/20" />

      {/* Model Confidence */}
      <div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Model Confidence</h4>
        <div className="flex items-end gap-3 mb-2">
          <span className={`text-4xl font-bold tabular-nums ${conf.color}`}>{play.confidence}%</span>
          <Badge variant="outline" className={`text-[10px] mb-1 ${conf.color}`}>{conf.label}</Badge>
        </div>
        <Progress value={play.confidence || 0} className="h-2 bg-muted/30" />
      </div>

      {/* Signal Sources */}
      <div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Signal Sources</h4>
        <div className="space-y-2">
          {engines.map((eng: string, i: number) => {
            const key = resolveEngine(eng);
            const meta = engineMeta[key] || engineMeta.ai;
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/20">
                <div className={`h-7 w-7 rounded-md border border-border/30 flex items-center justify-center bg-muted/20`}>
                  <meta.icon className={`h-3.5 w-3.5 ${meta.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground">Signal confirmed</p>
                </div>
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Consensus Strength */}
      <div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Consensus Strength</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/20 border border-border/20 text-center">
            <p className="text-2xl font-bold">{play.engine_count || engines.length}</p>
            <p className="text-[10px] text-muted-foreground">Engines Aligned</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/20 border border-border/20 text-center">
            <p className={`text-2xl font-bold ${tier.text}`}>{tier.label}</p>
            <p className="text-[10px] text-muted-foreground">Tier Rating</p>
          </div>
        </div>
      </div>

      {/* Why this play */}
      {(play.short_reason || play.full_reason) && (
        <div>
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Why This Play</h4>
          <div className="p-3 rounded-lg bg-muted/10 border border-border/20">
            {play.short_reason && <p className="text-sm font-medium mb-1">{play.short_reason}</p>}
            {play.full_reason && <p className="text-xs text-muted-foreground leading-relaxed">{play.full_reason}</p>}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
        <p className="text-[10px] text-amber-400/70 text-center uppercase tracking-widest font-medium">
          For manual review only — Not financial advice
        </p>
      </div>
    </div>
  );
}
