import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Swords, Eye, Crosshair, DollarSign, Target, ArrowRight,
  Play, Zap, Brain, ShieldAlert, TrendingUp, Users,
  MessageSquare, RefreshCw, Info, Lightbulb, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCompetitorDashboard,
  useRunCompetitorCycle,
  useAnalyzeWeaknesses,
  useGenerateUndercut,
} from "@/hooks/useBrandaroCompetitorTakeover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Flow Step Component ──
function FlowStep({ icon: Icon, label, description, color, isLast }: {
  icon: any; label: string; description: string; color: string; isLast?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", color.replace("text-", "bg-") + "/10")}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        {!isLast && <div className="w-0.5 h-8 bg-border mt-1" />}
      </div>
      <div className="pt-1.5">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ── Info Tooltip ──
function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Action Card ──
function ActionCard({ icon: Icon, title, description, result, onClick, loading, color }: {
  icon: any; title: string; description: string; result: string; onClick: () => void; loading?: boolean; color: string;
}) {
  return (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", color.replace("text-", "bg-") + "/10")}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            <div className="flex items-center gap-1 mt-1.5">
              <Lightbulb className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] text-muted-foreground italic">{result}</span>
            </div>
          </div>
        </div>
        <Button size="sm" className="w-full mt-3 gap-1.5" variant="outline" onClick={onClick} disabled={loading}>
          <Play className="h-3 w-3" /> {loading ? "Running…" : title}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CompetitorTakeoverPage() {
  const { data: dash, isLoading } = useCompetitorDashboard();
  const runCycle = useRunCompetitorCycle();
  const analyzeWeaknesses = useAnalyzeWeaknesses();
  const generateUndercut = useGenerateUndercut();
  const [role, setRole] = useState<"all" | "va" | "closer" | "manager">("all");

  const stats = dash?.stats || { totalCompetitors: 0, totalCaptured: 0, totalRevenue: 0, avgWinRate: 0 };

  return (
    <div className="space-y-6">
      {/* ── Header with system explanation ── */}
      <div className="bg-gradient-to-r from-red-500/5 via-orange-500/5 to-amber-500/5 rounded-xl p-6 border border-red-500/10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Swords className="h-6 w-6 text-red-500" /> Competitor Takeover Command Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              This system identifies competitors, finds their weaknesses, creates better offers, and helps you capture their customers automatically. Every competitor mention during calls triggers intelligent repositioning.
            </p>
          </div>
          <Button onClick={() => runCycle.mutate()} disabled={runCycle.isPending} className="gap-1.5 shrink-0">
            <Swords className="h-4 w-4" /> {runCycle.isPending ? "Running…" : "Run Full Cycle"}
          </Button>
        </div>

        {/* Role selector */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">View as:</span>
          {(["all", "va", "closer", "manager"] as const).map(r => (
            <Button key={r} size="sm" variant={role === r ? "default" : "outline"} className="h-6 text-[10px] px-2" onClick={() => setRole(r)}>
              {r === "all" ? "Everyone" : r === "va" ? "VA" : r === "closer" ? "Closer" : "Manager"}
            </Button>
          ))}
        </div>
      </div>

      {/* ── How It Works — Visual Flow ── */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" /> How It Works
            <InfoTip text="The system runs this loop continuously — manually via buttons or automatically in the background during calls." />
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {[
              { icon: Eye, label: "Track", desc: "Competitors are identified and logged", color: "text-red-500" },
              { icon: ShieldAlert, label: "Analyze", desc: "Weaknesses are detected and scored", color: "text-orange-500" },
              { icon: Target, label: "Offer", desc: "Counter-offers are generated", color: "text-amber-500" },
              { icon: Crosshair, label: "Convert", desc: "Leads are repositioned and closed", color: "text-green-500" },
              { icon: DollarSign, label: "Revenue", desc: "Money captured from competitors", color: "text-emerald-500" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex sm:flex-col items-center gap-2 text-center">
                <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", step.color.replace("text-", "bg-") + "/10")}>
                  <step.icon className={cn("h-6 w-6", step.color)} />
                </div>
                <div>
                  <p className="text-xs font-semibold">{step.label}</p>
                  <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                </div>
                {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Live Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="h-4 w-4 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold text-red-500">{stats.totalCompetitors}</p>
            <p className="text-[10px] text-muted-foreground">
              Competitors Tracked
              <InfoTip text="Number of competitors currently being monitored for weaknesses and market positioning." />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Crosshair className="h-4 w-4 mx-auto text-orange-500 mb-1" />
            <p className="text-2xl font-bold text-orange-500">{stats.totalCaptured}</p>
            <p className="text-[10px] text-muted-foreground">
              Leads Captured
              <InfoTip text="Leads that were originally considering a competitor but chose Brandaro instead." />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold text-green-500">${stats.totalRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">
              Revenue Captured
              <InfoTip text="Total revenue generated from leads that switched from competitors to Brandaro." />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-4 w-4 mx-auto text-purple-500 mb-1" />
            <p className="text-2xl font-bold text-purple-500">{stats.avgWinRate}%</p>
            <p className="text-[10px] text-muted-foreground">
              Win Rate vs Competitors
              <InfoTip text="Percentage of competitor-mentioned deals that Brandaro successfully closed." />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Primary Actions ── */}
      {(role === "all" || role === "manager") && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Play className="h-4 w-4 text-green-500" /> Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ActionCard
              icon={Eye}
              title="Analyze Competitor"
              description="Select a competitor to scan for exploitable weaknesses in their service, pricing, and positioning."
              result="Generates a list of scored weaknesses with recommended exploit strategies."
              onClick={() => {
                const first = dash?.competitors?.[0];
                if (first) analyzeWeaknesses.mutate(first.id);
              }}
              loading={analyzeWeaknesses.isPending}
              color="text-red-500"
            />
            <ActionCard
              icon={Target}
              title="Generate Counter-Offers"
              description="Create compelling offers that directly counter competitor strengths and exploit their gaps."
              result="Produces ready-to-use offers with urgency triggers and pricing strategies."
              onClick={() => {
                const first = dash?.competitors?.[0];
                if (first) generateUndercut.mutate(first.id);
              }}
              loading={generateUndercut.isPending}
              color="text-orange-500"
            />
            <ActionCard
              icon={Swords}
              title="Run Full Takeover Cycle"
              description="Analyze all competitors, extract weaknesses, and generate counter-offers in one sweep."
              result="Complete competitive intelligence refresh across all tracked competitors."
              onClick={() => runCycle.mutate()}
              loading={runCycle.isPending}
              color="text-amber-500"
            />
          </div>
        </div>
      )}

      {/* ── Intelligence Tabs ── */}
      <Tabs defaultValue="competitors" className="space-y-3">
        <TabsList>
          <TabsTrigger value="competitors" className="gap-1 text-xs"><Eye className="h-3 w-3" /> Competitors</TabsTrigger>
          <TabsTrigger value="weaknesses" className="gap-1 text-xs"><ShieldAlert className="h-3 w-3" /> Weaknesses</TabsTrigger>
          <TabsTrigger value="offers" className="gap-1 text-xs"><Target className="h-3 w-3" /> Counter-Offers</TabsTrigger>
          <TabsTrigger value="captures" className="gap-1 text-xs"><DollarSign className="h-3 w-3" /> Captures</TabsTrigger>
        </TabsList>

        {/* Competitors Tab */}
        <TabsContent value="competitors">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Competitor Intelligence</h3>
                  <p className="text-xs text-muted-foreground">Competitors we are actively tracking. We analyze them to find opportunities to win their customers.</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{dash?.competitors?.length || 0} tracked</Badge>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {(!dash?.competitors || dash.competitors.length === 0) ? (
                    <div className="text-center py-8">
                      <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No competitors tracked yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Add competitors manually or let the AI detect them during calls.</p>
                    </div>
                  ) : dash.competitors.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                          <Swords className="h-4 w-4 text-red-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{(c.weaknesses || []).length} known weaknesses</span>
                            {c.website && <span className="text-[10px] text-muted-foreground">• {c.website}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px]">{c.source}</Badge>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => analyzeWeaknesses.mutate(c.id)}>
                          <Eye className="h-3 w-3" /> Analyze
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weaknesses Tab */}
        <TabsContent value="weaknesses">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Exploitable Weaknesses</h3>
                <p className="text-xs text-muted-foreground">
                  These are gaps in competitor operations that we exploit to position Brandaro as the better choice.
                  {role === "va" && " Use these talking points when a lead mentions a competitor."}
                  {role === "closer" && " Reference these directly in your closing arguments."}
                </p>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {(!dash?.weaknesses || dash.weaknesses.length === 0) ? (
                    <div className="text-center py-8">
                      <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No weaknesses discovered yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Run an analysis cycle to discover competitor weaknesses.</p>
                    </div>
                  ) : dash.weaknesses.map((w: any) => (
                    <div key={w.id} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className={cn("text-[10px]",
                          Number(w.exploitability_score) >= 85 ? "border-red-500/30 text-red-600 bg-red-500/5" :
                          Number(w.exploitability_score) >= 70 ? "border-orange-500/30 text-orange-600 bg-orange-500/5" :
                          "border-amber-500/30 text-amber-600 bg-amber-500/5"
                        )}>
                          {w.exploitability_score}% exploitable
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{w.weakness_type?.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-xs mt-1">{w.description}</p>
                      <div className="mt-2 p-2 bg-green-500/5 border border-green-500/10 rounded-md">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Lightbulb className="h-3 w-3 text-green-500" />
                          <span className="text-[10px] font-semibold text-green-600">Strategy</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{w.exploit_strategy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Counter-Offers Tab */}
        <TabsContent value="offers">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Active Counter-Offers</h3>
                <p className="text-xs text-muted-foreground">
                  Offers designed to beat competitors. These are automatically used by AI during conversations when a competitor is mentioned.
                  {role === "va" && " Present these offers when the lead is comparing options."}
                  {role === "closer" && " Use the highest-converting offers to seal the deal."}
                </p>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {(!dash?.offers || dash.offers.length === 0) ? (
                    <div className="text-center py-8">
                      <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No counter-offers generated yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Generate offers by analyzing competitors first.</p>
                    </div>
                  ) : dash.offers.map((o: any) => (
                    <div key={o.id} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <Badge className="text-[10px] bg-primary/10 text-primary border-0">
                          {o.strategy?.replace(/_/g, " ")}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{o.times_used || 0}x used</span>
                          <Badge variant="outline" className={cn("text-[9px]",
                            Number(o.conversion_rate) > 20 ? "border-green-500/30 text-green-600" : "border-muted-foreground/30"
                          )}>
                            {o.conversion_rate || 0}% conversion
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs font-medium mt-1">{o.brandaro_counter_offer}</p>
                      {o.urgency_trigger && (
                        <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-orange-500/5 border border-orange-500/10 rounded-md">
                          <Zap className="h-3 w-3 text-orange-500 shrink-0" />
                          <span className="text-[10px] text-orange-600">{o.urgency_trigger}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Captures Tab */}
        <TabsContent value="captures">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Demand Captures</h3>
                <p className="text-xs text-muted-foreground">
                  Leads that were won from competitors. Each entry represents a customer who chose Brandaro over a competitor.
                </p>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {(!dash?.captures || dash.captures.length === 0) ? (
                    <div className="text-center py-8">
                      <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No captures recorded yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Captures are logged automatically when leads convert from competitors.</p>
                    </div>
                  ) : dash.captures.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[9px]",
                            c.outcome === "won" ? "border-green-500/30 text-green-600" :
                            c.outcome === "lost" ? "border-red-500/30 text-red-600" :
                            "border-amber-500/30 text-amber-600"
                          )}>
                            {c.outcome?.toUpperCase()}
                          </Badge>
                          {c.capture_method && <span className="text-[10px] text-muted-foreground">{c.capture_method}</span>}
                        </div>
                        {c.reposition_strategy && (
                          <p className="text-[10px] text-muted-foreground mt-1">Strategy: {c.reposition_strategy}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {c.revenue_captured > 0 && (
                          <p className="text-sm font-bold text-green-600">${Number(c.revenue_captured).toLocaleString()}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Real-Time Behavior Explanation ── */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
            <Brain className="h-4 w-4 text-blue-500" /> Real-Time AI Behavior
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            When a lead mentions a competitor during a call or conversation, the AI automatically:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { icon: MessageSquare, label: "Detects Mention", desc: "Recognizes competitor names and context", color: "text-blue-500" },
              { icon: Brain, label: "Selects Strategy", desc: "Picks the best counter-approach", color: "text-purple-500" },
              { icon: Target, label: "Repositions", desc: "Highlights Brandaro's advantages", color: "text-green-500" },
              { icon: TrendingUp, label: "Drives Close", desc: "Uses urgency + counter-offer", color: "text-emerald-500" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 p-2 bg-background/60 rounded-lg">
                <s.icon className={cn("h-4 w-4 shrink-0", s.color)} />
                <div>
                  <p className="text-xs font-medium">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 italic">
            No direct negativity or unethical claims — the AI acknowledges the competitor, subtly exposes gaps, and guides the lead toward a decision.
          </p>
        </CardContent>
      </Card>

      {/* ── Automation Status ── */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
            <RefreshCw className="h-4 w-4 text-green-500" /> Automation Status
          </h2>
          <p className="text-xs text-muted-foreground mb-3">This system runs automatically in the background:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Competitor Analysis", status: "Active", color: "bg-green-500" },
              { label: "Offer Generation", status: "Active", color: "bg-green-500" },
              { label: "Performance Tracking", status: "Active", color: "bg-green-500" },
              { label: "Self-Improvement", status: "Active", color: "bg-green-500" },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                <span className="text-xs">{s.label}</span>
                <div className="flex items-center gap-1">
                  <div className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
                  <span className="text-[10px] font-medium text-green-600">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
