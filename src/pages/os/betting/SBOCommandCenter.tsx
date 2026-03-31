import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw, Trophy, BarChart3, Globe, MessageSquare, Zap,
  TrendingUp, Shield, ChevronRight, Activity, Target, X,
  AlertTriangle, CheckCircle, Clock, Filter
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ── Helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

const tierConfig: Record<string, { label: string; bg: string; text: string; border: string; glow: string }> = {
  "ELITE BET": {
    label: "ELITE",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    glow: "shadow-amber-500/10",
  },
  "STRONG BET": {
    label: "STRONG",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    glow: "shadow-emerald-500/10",
  },
  WATCHLIST: {
    label: "WATCH",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
    glow: "shadow-blue-500/10",
  },
};

const getTier = (action: string) => tierConfig[action] || tierConfig.WATCHLIST;

const confLevel = (c: number) => {
  if (c >= 80) return { label: "High", color: "text-amber-400", bar: "bg-amber-500", pct: c };
  if (c >= 60) return { label: "Medium", color: "text-emerald-400", bar: "bg-emerald-500", pct: c };
  return { label: "Low", color: "text-blue-400", bar: "bg-blue-500", pct: c };
};

const engineIcons: Record<string, { icon: typeof BarChart3; color: string; label: string }> = {
  props: { icon: BarChart3, color: "text-purple-400", label: "Props Engine" },
  polymarket: { icon: Globe, color: "text-cyan-400", label: "Polymarket" },
  cappers: { icon: MessageSquare, color: "text-orange-400", label: "Capper Signals" },
  ai: { icon: Zap, color: "text-amber-400", label: "AI Analysis" },
};

// ── Main Component ──────────────────────────────────────────────────────────
export default function SBOCommandCenter() {
  const [running, setRunning] = useState(false);
  const [selectedPlay, setSelectedPlay] = useState<any | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");
  const [engineFilter, setEngineFilter] = useState<string>("all");

  // ── Queries ───────────────────────────────────────────────────────────────
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
      const { data } = await (supabase as any)
        .from("props_master")
        .select("player_name, stat_type, line, ai_confidence, ai_recommendation, over_odds, under_odds, platform, consensus_score")
        .eq("game_date", today())
        .not("ai_confidence", "is", null)
        .gte("ai_confidence", 50)
        .order("ai_confidence", { ascending: false })
        .limit(30);
      return (data as any[]) || [];
    },
  });

  const { data: polySignals, refetch: refetchPoly } = useQuery({
    queryKey: ["sbo-poly-signals", today()],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sbo_odds_comparison")
        .select("*")
        .eq("has_value", true)
        .gte("created_at", `${today()}T00:00:00`)
        .limit(30);
      return (data as any[]) || [];
    },
  });

  const { data: capperPicks, refetch: refetchCappers } = useQuery({
    queryKey: ["sbo-capper-signals", today()],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sbo_capper_picks")
        .select("capper_id, player_name, stat_type, direction, line, edge_score, source, review_status")
        .eq("game_date", today())
        .eq("review_status", "verified")
        .limit(30);
      return (data as any[]) || [];
    },
  });

  // ── Pipeline ──────────────────────────────────────────────────────────────
  const runPipeline = async () => {
    setRunning(true);
    toast.info("Running full SBO pipeline...");
    try {
      const { error } = await supabase.functions.invoke("sbo-top-plays");
      if (error) throw error;
      toast.success("Pipeline complete — picks updated!");
      refetchTop(); refetchProps(); refetchPoly(); refetchCappers();
    } catch (e: any) {
      toast.error("Pipeline failed: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filteredPlays = useMemo(() => {
    let plays = topPlays || [];
    if (confidenceFilter === "high") plays = plays.filter((p: any) => (p.confidence || 0) >= 80);
    else if (confidenceFilter === "medium") plays = plays.filter((p: any) => (p.confidence || 0) >= 60 && (p.confidence || 0) < 80);
    else if (confidenceFilter === "low") plays = plays.filter((p: any) => (p.confidence || 0) < 60);
    if (engineFilter !== "all") {
      plays = plays.filter((p: any) => (p.engines_agreed || []).some((e: string) => e.toLowerCase().includes(engineFilter)));
    }
    return plays;
  }, [topPlays, confidenceFilter, engineFilter]);

  const eliteCount = (topPlays || []).filter((p: any) => p.recommended_action === "ELITE BET").length;
  const strongCount = (topPlays || []).filter((p: any) => p.recommended_action === "STRONG BET").length;

  // ── Engine status ─────────────────────────────────────────────────────────
  const engineStatus = [
    { name: "Props Engine", status: (propsData || []).length > 0 ? "active" : "idle", icon: BarChart3, color: "text-purple-400" },
    { name: "Polymarket", status: (polySignals || []).length > 0 ? "active" : "idle", icon: Globe, color: "text-cyan-400" },
    { name: "Capper Feed", status: (capperPicks || []).length > 0 ? "active" : "idle", icon: MessageSquare, color: "text-orange-400" },
    { name: "Consensus AI", status: (topPlays || []).length > 0 ? "active" : "idle", icon: Zap, color: "text-amber-400" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">SBO Intelligence</h1>
                <p className="text-xs text-muted-foreground">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Engine status pills */}
              <div className="hidden md:flex items-center gap-1.5">
                {engineStatus.map((e) => (
                  <Tooltip key={e.name}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
                        <div className={`h-1.5 w-1.5 rounded-full ${e.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"}`} />
                        <e.icon className={`h-3.5 w-3.5 ${e.color}`} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">{e.name}: {e.status === "active" ? "Running" : "Idle"}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <Button onClick={runPipeline} disabled={running} size="sm" variant="outline" className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
                {running ? "Running..." : "Run Pipeline"}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-5 space-y-5">
          {/* ── KPI STRIP ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Plays", value: (topPlays || []).length, icon: Target, color: "text-foreground" },
              { label: "Elite Bets", value: eliteCount, icon: Zap, color: "text-amber-400" },
              { label: "Strong Bets", value: strongCount, icon: TrendingUp, color: "text-emerald-400" },
              { label: "Engines Live", value: engineStatus.filter(e => e.status === "active").length, icon: Activity, color: "text-cyan-400", suffix: `/${engineStatus.length}` },
              { label: "Avg Confidence", value: (topPlays || []).length > 0 ? Math.round((topPlays || []).reduce((s: number, p: any) => s + (p.confidence || 0), 0) / (topPlays || []).length) : 0, icon: Shield, color: "text-purple-400", suffix: "%" },
            ].map((s) => (
              <Card key={s.label} className="bg-card/40 border-border/40 hover:border-border/60 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
                    <s.icon className={`h-3.5 w-3.5 ${s.color} opacity-60`} />
                  </div>
                  <div className={`text-2xl font-bold tabular-nums ${s.color}`}>
                    {s.value}{(s as any).suffix || ""}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── FILTERS ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs bg-card/40 border-border/40">
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
              <SelectTrigger className="w-[140px] h-8 text-xs bg-card/40 border-border/40">
                <SelectValue placeholder="Engine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Engines</SelectItem>
                <SelectItem value="props">📊 Props</SelectItem>
                <SelectItem value="poly">💰 Polymarket</SelectItem>
                <SelectItem value="capper">📢 Cappers</SelectItem>
              </SelectContent>
            </Select>
            {(confidenceFilter !== "all" || engineFilter !== "all") && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setConfidenceFilter("all"); setEngineFilter("all"); }}>
                Clear filters
              </Button>
            )}
          </div>

          {/* ── TOP CONSENSUS PICKS (Hero) ────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-amber-400" />
              <h2 className="text-base font-semibold">Top AI Consensus Picks</h2>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 ml-1">
                {filteredPlays.length} picks
              </Badge>
            </div>

            {filteredPlays.length === 0 ? (
              <Card className="border-dashed border-border/40 bg-card/20">
                <CardContent className="py-12 text-center">
                  <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No consensus picks yet today.</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">Run the pipeline to generate picks.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPlays.map((play: any, i: number) => {
                  const tier = getTier(play.recommended_action);
                  const conf = confLevel(play.confidence || 0);
                  const engines = play.engines_agreed || [];
                  return (
                    <motion.div
                      key={play.id || i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card
                        className={`cursor-pointer group hover:shadow-lg transition-all duration-200 ${tier.bg} ${tier.border} ${tier.glow} hover:scale-[1.01]`}
                        onClick={() => setSelectedPlay(play)}
                      >
                        <CardContent className="p-4">
                          {/* Tier badge + confidence */}
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className={`text-[10px] font-bold tracking-wider ${tier.text} ${tier.border}`}>
                              {tier.label}
                            </Badge>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-lg font-bold tabular-nums ${conf.color}`}>{play.confidence}%</span>
                            </div>
                          </div>

                          {/* Player + Pick */}
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-foreground leading-tight">{play.player_name || "Market Play"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{play.pick}</p>
                          </div>

                          {/* Confidence bar */}
                          <div className="mb-3">
                            <Progress value={play.confidence || 0} className="h-1.5 bg-muted/50" />
                          </div>

                          {/* Engines */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {engines.map((eng: string, ei: number) => {
                                const key = eng.toLowerCase().includes("prop") ? "props" : eng.toLowerCase().includes("poly") ? "polymarket" : eng.toLowerCase().includes("capper") ? "cappers" : "ai";
                                const meta = engineIcons[key] || engineIcons.ai;
                                return (
                                  <Tooltip key={ei}>
                                    <TooltipTrigger asChild>
                                      <div className={`h-6 w-6 rounded-md border border-border/40 flex items-center justify-center bg-muted/30`}>
                                        <meta.icon className={`h-3 w-3 ${meta.color}`} />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px]">{meta.label}</TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
                              <span>{play.engine_count} engines</span>
                              <ChevronRight className="h-3 w-3" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── ENGINE PANELS (3 columns on desktop) ──────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-semibold">AI Engine Signals</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Props Engine */}
              <Card className="bg-card/40 border-border/40">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <BarChart3 className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    Props Engine
                    <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">{(propsData || []).length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ScrollArea className="h-[320px]">
                    {(propsData || []).length === 0 ? (
                      <EmptyState label="No props signals" />
                    ) : (
                      <div className="space-y-2">
                        {(propsData || []).map((p: any, i: number) => {
                          const c = confLevel(p.ai_confidence || 0);
                          return (
                            <div key={i} className="p-2.5 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold">{p.player_name}</span>
                                <Badge variant="outline" className={`text-[10px] ${p.ai_recommendation === "OVER" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"}`}>
                                  {p.ai_recommendation}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>{p.stat_type} • Line {p.line}</span>
                                <span className={`font-medium ${c.color}`}>{p.ai_confidence}%</span>
                              </div>
                              <Progress value={p.ai_confidence || 0} className="h-1 mt-1.5 bg-muted/50" />
                              <div className="text-[10px] text-muted-foreground/60 mt-1">{p.platform}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Polymarket */}
              <Card className="bg-card/40 border-border/40">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Globe className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    Polymarket
                    <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">{(polySignals || []).length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ScrollArea className="h-[320px]">
                    {(polySignals || []).length === 0 ? (
                      <EmptyState label="No value signals" />
                    ) : (
                      <div className="space-y-2">
                        {(polySignals || []).map((s: any, i: number) => {
                          const edge = ((s.implied_edge || 0) * 100);
                          return (
                            <div key={i} className="p-2.5 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
                              <p className="text-xs font-semibold mb-1 leading-tight">{s.description || s.market_slug}</p>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">Edge</span>
                                <span className="text-emerald-400 font-bold">+{edge.toFixed(1)}%</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>Poly: {s.polymarket_odds || "-"}</span>
                                <span>Book: {s.sportsbook_odds || "-"}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1.5">
                                <div className={`h-1.5 w-1.5 rounded-full ${edge >= 10 ? "bg-emerald-400" : "bg-amber-400"}`} />
                                <span className="text-[10px] text-muted-foreground">{edge >= 10 ? "Smart Money" : "Moderate"}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Cappers */}
              <Card className="bg-card/40 border-border/40">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <MessageSquare className="h-3.5 w-3.5 text-orange-400" />
                    </div>
                    Capper Signals
                    <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">{(capperPicks || []).length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ScrollArea className="h-[320px]">
                    {(capperPicks || []).length === 0 ? (
                      <EmptyState label="No capper picks" />
                    ) : (
                      <div className="space-y-2">
                        {(capperPicks || []).map((c: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold">{c.player_name || "Market"}</span>
                              <Badge variant="outline" className={`text-[10px] ${c.direction === "OVER" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"}`}>
                                {c.direction}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground">{c.stat_type} {c.line}</div>
                            <div className="flex items-center justify-between mt-1.5 text-[10px]">
                              <span className="text-muted-foreground/60">{c.capper_id || "Unknown"}</span>
                              {c.edge_score && <span className="text-emerald-400 font-medium">Edge: {c.edge_score}</span>}
                            </div>
                            <div className="text-[10px] text-muted-foreground/50 mt-0.5">{c.source || "Telegram"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ── PIPELINE STATUS ───────────────────────────────────────── */}
          <Card className="bg-card/30 border-border/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-6 overflow-x-auto text-xs">
                {[
                  { label: "Data Collection", active: true },
                  { label: "AI Analysis", active: true },
                  { label: "Consensus Detection", active: (topPlays || []).length > 0 },
                  { label: "Daily Report", active: false },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-2 whitespace-nowrap">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step.active ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-muted/50 text-muted-foreground border border-border/30"}`}>
                      {step.active ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    </div>
                    <span className={step.active ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                    {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── DETAIL PANEL (Slide-over) ────────────────────────────── */}
        <AnimatePresence>
          {selectedPlay && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/50 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPlay(null)}
              />
              <motion.div
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-50 overflow-y-auto"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
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

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
      <AlertTriangle className="h-6 w-6 mb-2" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ play, onClose }: { play: any; onClose: () => void }) {
  const tier = getTier(play.recommended_action);
  const conf = confLevel(play.confidence || 0);
  const engines = play.engines_agreed || [];

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Badge variant="outline" className={`text-[10px] font-bold tracking-wider mb-2 ${tier.text} ${tier.border}`}>
            {tier.label}
          </Badge>
          <h3 className="text-lg font-bold">{play.player_name || "Market Play"}</h3>
          <p className="text-sm text-muted-foreground">{play.pick}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="bg-border/30" />

      {/* Confidence */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Model Confidence</h4>
        <div className="flex items-end gap-3 mb-2">
          <span className={`text-4xl font-bold tabular-nums ${conf.color}`}>{play.confidence}%</span>
          <Badge variant="outline" className={`text-[10px] mb-1 ${conf.color}`}>{conf.label}</Badge>
        </div>
        <Progress value={play.confidence || 0} className="h-2 bg-muted/50" />
      </div>

      {/* Signal Sources */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Signal Sources</h4>
        <div className="space-y-2">
          {engines.map((eng: string, i: number) => {
            const key = eng.toLowerCase().includes("prop") ? "props" : eng.toLowerCase().includes("poly") ? "polymarket" : eng.toLowerCase().includes("capper") ? "cappers" : "ai";
            const meta = engineIcons[key] || engineIcons.ai;
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                <div className={`h-7 w-7 rounded-md border border-border/40 flex items-center justify-center bg-muted/30`}>
                  <meta.icon className={`h-3.5 w-3.5 ${meta.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground">Signal confirmed</p>
                </div>
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 ml-auto" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Consensus strength */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Consensus Strength</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
            <p className="text-2xl font-bold text-foreground">{play.engine_count || engines.length}</p>
            <p className="text-[10px] text-muted-foreground">Engines Aligned</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
            <p className={`text-2xl font-bold ${tier.text}`}>{tier.label}</p>
            <p className="text-[10px] text-muted-foreground">Tier Rating</p>
          </div>
        </div>
      </div>

      {/* Reasoning */}
      {(play.short_reason || play.full_reason) && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Why This Play</h4>
          <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
            {play.short_reason && <p className="text-sm font-medium mb-1">{play.short_reason}</p>}
            {play.full_reason && <p className="text-xs text-muted-foreground leading-relaxed">{play.full_reason}</p>}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <p className="text-[10px] text-amber-400/80 text-center uppercase tracking-wider font-medium">
          For manual review only — Not financial advice
        </p>
      </div>
    </div>
  );
}
