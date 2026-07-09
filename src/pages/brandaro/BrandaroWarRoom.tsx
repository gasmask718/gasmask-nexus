import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DollarSign, Phone, Flame, TrendingUp, ListTodo, Bot,
  Users, Brain, Theater, AlertTriangle, Zap, Target,
  ArrowRight, Clock, Cpu, Play, CheckCircle, XCircle,
  RefreshCw, MailCheck, Dna, Crown, Skull, Sparkles,
  Swords, ShieldAlert, Crosshair, Eye,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCloserKPIs } from "@/hooks/useBrandaroCloserAI";
import { useBrandaroAutomationStats } from "@/hooks/useBrandaroAutomation";
import { useClosingPsychologyStats } from "@/hooks/useBrandaroClosingPsychology";
import { useEvolutionDashboard, useRunEvolutionCycle } from "@/hooks/useBrandaroPersonalityEvolution";
import { useRevenueAutopilotDashboard, useRunAutopilotCycle } from "@/hooks/useBrandaroRevenueAutopilot";
import { useGlobalScalingDashboard, useRunGlobalCycle } from "@/hooks/useBrandaroGlobalScaling";
import { useCompetitorDashboard, useRunCompetitorCycle } from "@/hooks/useBrandaroCompetitorTakeover";
import { Repeat, Rocket, PiggyBank, BarChart3, Globe, MapPinPlus, Building2 } from "lucide-react";
import { WarRoomLiveSnapshot } from "@/components/brandaro/WarRoomLiveSnapshot";

function KPICard({ label, value, icon: Icon, color, subtitle, to }: {
  label: string; value: string | number; icon: any; color: string; subtitle?: string; to?: string;
}) {
  const card = (
    <Card className={cn("hover:shadow-md transition-all cursor-pointer group", to && "hover:border-primary/30")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums mt-0.5", color)}>{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", color.replace("text-", "bg-") + "/10")}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}

export default function BrandaroWarRoom() {
  const { data: kpis } = useCloserKPIs();
  const { stats: autoStats, recentLogs } = useBrandaroAutomationStats();
  const { stats: psyStats } = useClosingPsychologyStats();
  const { data: evoDash } = useEvolutionDashboard();
  const runEvolution = useRunEvolutionCycle();
  const autopilot = useRevenueAutopilotDashboard();
  const runAutopilot = useRunAutopilotCycle();
  const { data: globalDash } = useGlobalScalingDashboard();
  const runGlobalCycle = useRunGlobalCycle();
  const { data: compDash } = useCompetitorDashboard();
  const runCompetitorCycle = useRunCompetitorCycle();

  // Active calls count
  const { data: activeCalls = 0 } = useQuery({
    queryKey: ["brandaro-war-active-calls"],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("live_calls")
        .select("id", { count: "exact", head: true })
        .not("state", "in", '("completed","failed")');
      return count || 0;
    },
    refetchInterval: 10000,
  });

  // Hot leads
  const { data: hotLeads = 0 } = useQuery({
    queryKey: ["brandaro-war-hot-leads"],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("brandaro_va_lead_heat")
        .select("id", { count: "exact", head: true })
        .gte("heat_score", 70);
      return count || 0;
    },
    refetchInterval: 15000,
  });

  // Pending tasks
  const { data: pendingTasks = 0 } = useQuery({
    queryKey: ["brandaro-war-pending-tasks"],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("brandaro_va_task_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
    refetchInterval: 15000,
  });

  // Recent alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ["brandaro-war-alerts"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_va_alerts")
        .select("*")
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    refetchInterval: 10000,
  });

  // VA leaderboard top 3
  const { data: topVAs = [] } = useQuery({
    queryKey: ["brandaro-war-top-vas"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_va_performance")
        .select("va_user_id, daily_score, calls_today, interested_today")
        .order("daily_score", { ascending: false })
        .limit(3);
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Personality stats
  const { data: activePersonalities = 0 } = useQuery({
    queryKey: ["brandaro-war-personalities"],
    queryFn: async () => {
      const { count } = await supabase
        .from("brandaro_personalities")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      return count || 0;
    },
  });

  // Scout Agent stats
  const { data: scoutStats } = useQuery({
    queryKey: ["brandaro-scout-stats"],
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [
        { count: total },
        { count: today },
        { count: inPipeline },
        { data: config },
      ] = await Promise.all([
        supabase.from("brandaro_qualified_leads").select("*", { count: "exact", head: true }).not("discovery_job_id", "is", null),
        supabase.from("brandaro_qualified_leads").select("*", { count: "exact", head: true }).gte("created_at", yesterday).not("discovery_job_id", "is", null),
        supabase.from("brandaro_qualified_leads").select("*", { count: "exact", head: true }).eq("pipeline_stage", "new").not("discovery_job_id", "is", null),
        supabase.from("brandaro_scout_config" as any).select("*").limit(1).single(),
      ]);
      return { total, today, inPipeline, config: config as any };
    },
    refetchInterval: 60000,
  });

  // FIX A — 4 missing wires: revenue total, today's calls, pending messages, pipeline funnel
  const { data: revenueTotal = 0 } = useQuery({
    queryKey: ["brandaro-war-revenue-total"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_revenue_tracking")
        .select("revenue_amount");
      return (data || []).reduce((s: number, r: any) => s + Number(r.revenue_amount || 0), 0);
    },
    refetchInterval: 60000,
  });

  const { data: callsToday = 0 } = useQuery({
    queryKey: ["brandaro-war-calls-today"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count } = await (supabase as any)
        .from("brandaro_ai_calls")
        .select("id", { count: "exact", head: true })
        .gte("called_at", startOfDay.toISOString());
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: pendingMessages = 0 } = useQuery({
    queryKey: ["brandaro-war-pending-messages"],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("brandaro_pending_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
    refetchInterval: 15000,
  });

  const { data: pipelineFunnel = [] } = useQuery({
    queryKey: ["brandaro-war-pipeline-funnel"],
    queryFn: async () => {
      const stages = ["prospect", "contacted", "interested", "demo_sent", "proposal", "won"];
      const results = await Promise.all(
        stages.map(async (stage) => {
          const { count } = await (supabase as any)
            .from("brandaro_qualified_leads")
            .select("id", { count: "exact", head: true })
            .eq("pipeline_stage", stage);
          return { stage, count: count || 0 };
        })
      );
      return results;
    },
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          ⚔️ Brandaro War Room
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time command center for the Brandaro sales machine
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Revenue" value={`$${(kpis?.totalRevenue || 0).toLocaleString()}`} icon={DollarSign} color="text-green-600" to="/brandaro/revenue" />
        <KPICard label="Active Calls" value={activeCalls} icon={Phone} color="text-blue-500" subtitle="Live now" to="/brandaro/calling" />
        <KPICard label="Hot Leads" value={hotLeads} icon={Flame} color="text-orange-500" subtitle="Score ≥ 70" to="/brandaro/leads" />
        <KPICard label="Close Rate" value={`${kpis?.closeRate || 0}%`} icon={TrendingUp} color="text-emerald-500" to="/brandaro/closer-ai" />
        <KPICard label="Pending Tasks" value={pendingTasks} icon={ListTodo} color="text-amber-500" to="/brandaro/follow-ups" />
        <KPICard label="AI Personas" value={activePersonalities} icon={Theater} color="text-purple-500" to="/brandaro/personalities" />
      </div>

      {/* Live Snapshot — confirmed source-of-truth tables */}
      <WarRoomLiveSnapshot />

      {/* Scout Agent Card */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-primary" /> Scout Agent
            </h3>
            <Badge variant={scoutStats?.config?.is_active ? "default" : "secondary"} className="text-[10px]">
              {scoutStats?.config?.is_active ? "Active" : "Paused"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Total discovered:</span> <span className="font-medium">{scoutStats?.total || 0}</span></div>
            <div><span className="text-muted-foreground">Today:</span> <span className="font-medium text-green-600">{scoutStats?.today || 0}</span></div>
            <div><span className="text-muted-foreground">Awaiting outreach:</span> <span className="font-medium">{scoutStats?.inPipeline || 0}</span></div>
            <div><span className="text-muted-foreground">Cost today:</span> <span className="font-medium">${(scoutStats?.config?.daily_spend_today || 0).toFixed(2)}</span></div>
          </div>
          <Link to="/brandaro/scout-agent">
            <Button variant="outline" size="sm" className="w-full mt-3 h-7 text-xs gap-1">
              <Bot className="h-3 w-3" /> Go to Scout
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Alerts + Quick Actions */}
        <div className="space-y-4">
          {/* Alerts */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-orange-500" /> Live Alerts
                </h3>
                <Badge variant="outline" className="text-[10px]">{alerts.length}</Badge>
              </div>
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No active alerts</p>
                  ) : alerts.map((a: any) => (
                    <div key={a.id} className={cn(
                      "p-2 rounded-md border text-xs",
                      a.severity === "critical" ? "bg-red-500/5 border-red-500/20" : "bg-yellow-500/5 border-yellow-500/20"
                    )}>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold mb-2">⚡ Quick Actions</h3>
              <Link to="/brandaro/calling">
                <Button size="sm" className="w-full justify-start gap-2" variant="outline">
                  <Phone className="h-3.5 w-3.5" /> Open Dialer
                </Button>
              </Link>
              <Link to="/brandaro/closer-ai">
                <Button size="sm" className="w-full justify-start gap-2" variant="outline">
                  <Brain className="h-3.5 w-3.5" /> Closer AI Brain
                </Button>
              </Link>
              <Link to="/brandaro/va-dashboard">
                <Button size="sm" className="w-full justify-start gap-2" variant="outline">
                  <Users className="h-3.5 w-3.5" /> VA Floor
                </Button>
              </Link>
              <Link to="/brandaro/domination">
                <Button size="sm" className="w-full justify-start gap-2" variant="outline">
                  <Target className="h-3.5 w-3.5" /> Market Domination
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Performance Summary */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <TrendingUp className="h-4 w-4 text-green-500" /> Sales Performance
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-green-600">{kpis?.won || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Wins</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-red-500">{kpis?.lost || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Losses</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-500">{kpis?.totalSessions || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Total Sessions</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-purple-500">{kpis?.linkConversion || 0}%</p>
                  <p className="text-[10px] text-muted-foreground">Link Conv.</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="text-xs text-muted-foreground">
                  <Bot className="h-3 w-3 inline mr-1" /> AI Wins: {kpis?.aiOnlyWins || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  <Users className="h-3 w-3 inline mr-1" /> Human Wins: {kpis?.humanAssistedWins || 0}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top VAs */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-amber-500" /> Top VAs Today
                </h3>
                <Link to="/brandaro/va-dashboard" className="text-[10px] text-primary flex items-center gap-0.5">
                  View All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {topVAs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No VA data yet</p>
                ) : topVAs.map((va: any, i: number) => (
                  <div key={va.va_user_id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                      <div>
                        <p className="text-xs font-medium">{va.va_user_id?.slice(0, 8)}…</p>
                        <p className="text-[10px] text-muted-foreground">{va.calls_today || 0} calls</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{va.daily_score || 0} pts</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 3: AI Intelligence Feed */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <Brain className="h-4 w-4 text-purple-500" /> AI Intelligence
              </h3>
              <div className="space-y-3">
                <div className="p-2 bg-purple-500/5 border border-purple-500/10 rounded-lg">
                  <p className="text-[10px] font-semibold text-purple-600 uppercase">Active Personas</p>
                  <p className="text-lg font-bold">{activePersonalities}</p>
                  <p className="text-[10px] text-muted-foreground">personalities deployed</p>
                </div>
                <div className="p-2 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase">Avg Touches to Close</p>
                  <p className="text-lg font-bold">{kpis?.avgTouchesToClose || 0}</p>
                  <p className="text-[10px] text-muted-foreground">interactions per deal</p>
                </div>
                <div className="p-2 bg-green-500/5 border border-green-500/10 rounded-lg">
                  <p className="text-[10px] font-semibold text-green-600 uppercase">Payment Links</p>
                  <p className="text-lg font-bold">{kpis?.linksSent || 0} sent / {kpis?.linksClicked || 0} clicked</p>
                  <p className="text-[10px] text-muted-foreground">{kpis?.linkConversion || 0}% conversion</p>
                </div>
              </div>
              <Link to="/brandaro/ai-brain" className="flex items-center gap-1 text-xs text-primary mt-3 pt-2 border-t">
                Open AI Brain <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Live Status */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <Zap className="h-4 w-4 text-yellow-500" /> System Status
              </h3>
              <div className="space-y-1.5">
                {[
                  { label: "Dialer", status: "online", color: "bg-green-500" },
                  { label: "AI Brain", status: "active", color: "bg-green-500" },
                  { label: "Persona Engine", status: `${activePersonalities} active`, color: "bg-green-500" },
                  { label: "Emotion Detection", status: "ready", color: "bg-green-500" },
                  { label: "Learning Engine", status: "running", color: "bg-green-500" },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-1">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
                      <span className="text-[10px] font-medium">{s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── AI Closing Psychology Panel ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              ⚔️ <span>AI Closing Psychology Engine</span>
            </h3>
            <div className="flex items-center gap-2">
              <Badge className="text-[10px] bg-purple-500/10 text-purple-600 border-0">
                {psyStats.interactions} interactions
              </Badge>
              {psyStats.revenue > 0 && (
                <Badge className="text-[10px] bg-green-500/10 text-green-600 border-0">
                  ${psyStats.revenue.toLocaleString()} closed
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <Target className="h-3.5 w-3.5 mx-auto text-purple-500 mb-1" />
              <p className="text-lg font-bold text-purple-500">{psyStats.closeRate}%</p>
              <p className="text-[9px] text-muted-foreground">Close Rate</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <Brain className="h-3.5 w-3.5 mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-bold text-blue-500">{psyStats.objectionWinRate}%</p>
              <p className="text-[9px] text-muted-foreground">Objection Win</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <Flame className="h-3.5 w-3.5 mx-auto text-orange-500 mb-1" />
              <p className="text-lg font-bold text-orange-500">{psyStats.buyingSignals}</p>
              <p className="text-[9px] text-muted-foreground">Buy Signals</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <CheckCircle className="h-3.5 w-3.5 mx-auto text-green-500 mb-1" />
              <p className="text-lg font-bold text-green-600">{psyStats.closed}</p>
              <p className="text-[9px] text-muted-foreground">Deals Closed</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <DollarSign className="h-3.5 w-3.5 mx-auto text-emerald-500 mb-1" />
              <p className="text-lg font-bold text-emerald-500">${psyStats.revenue.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground">AI Revenue</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <Zap className="h-3.5 w-3.5 mx-auto text-amber-500 mb-1" />
              <p className="text-lg font-bold text-amber-500">{psyStats.interactions}</p>
              <p className="text-[9px] text-muted-foreground">Total Actions</p>
            </div>
          </div>

          {/* Persuasion Pipeline */}
          <div className="border rounded-lg p-3 mb-4 bg-muted/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">⚔️ Persuasion Pipeline</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[
                { label: "Detect Emotion", icon: "🧠", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
                { label: "→", icon: "", color: "" },
                { label: "Select Framework", icon: "📐", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
                { label: "→", icon: "", color: "" },
                { label: "Handle Objections", icon: "🛡️", color: "bg-red-500/10 text-red-600 border-red-500/20" },
                { label: "→", icon: "", color: "" },
                { label: "Inject Urgency", icon: "⏰", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
                { label: "→", icon: "", color: "" },
                { label: "Decision Control", icon: "🎯", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
                { label: "→", icon: "", color: "" },
                { label: "Close Deal", icon: "💰", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
              ].map((step, i) =>
                step.icon ? (
                  <span key={i} className={cn("text-[10px] font-medium px-2 py-1 rounded-md border whitespace-nowrap", step.color)}>
                    {step.icon} {step.label}
                  </span>
                ) : (
                  <span key={i} className="text-xs text-muted-foreground">→</span>
                )
              )}
            </div>
          </div>

          {/* Top Frameworks + Objection Responses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Top Frameworks</p>
              <div className="space-y-1.5">
                {psyStats.topFrameworks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No data yet</p>
                ) : psyStats.topFrameworks.slice(0, 4).map((fw: any, i: number) => (
                  <div key={fw.id || i} className="flex items-center justify-between p-1.5 bg-muted/30 rounded text-xs">
                    <span className="font-medium">{fw.framework_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{fw.times_used} uses</span>
                      <Badge variant="outline" className="text-[9px]">{Number(fw.close_rate || 0).toFixed(0)}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Top Objection Killers</p>
              <div className="space-y-1.5">
                {psyStats.topObjectionResponses.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No data yet</p>
                ) : psyStats.topObjectionResponses.slice(0, 4).map((obj: any, i: number) => (
                  <div key={obj.id || i} className="flex items-center justify-between p-1.5 bg-muted/30 rounded text-xs">
                    <span className="font-medium truncate max-w-[120px]">"{obj.objection_text}"</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[9px]",
                        Number(obj.win_rate) >= 60 ? "border-green-500/30 text-green-600" : "border-amber-500/30 text-amber-600"
                      )}>{Number(obj.win_rate || 0).toFixed(0)}% win</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Autonomous Execution Engine Panel ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-primary" /> Autonomous Execution Engine
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {autoStats.activeAutomations} rules
              </Badge>
              <Badge className="text-[10px] bg-primary/10 text-primary border-0">
                {autoStats.total24h} actions today
              </Badge>
              {autoStats.revenueGenerated > 0 && (
                <Badge className="text-[10px] bg-green-500/10 text-green-600 border-0">
                  ${autoStats.revenueGenerated.toLocaleString()} AI revenue
                </Badge>
              )}
            </div>
          </div>

          {/* Execution metrics */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <Phone className="h-3.5 w-3.5 mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-bold text-blue-500">{autoStats.callsInitiated}</p>
              <p className="text-[9px] text-muted-foreground">AI Calls</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <MailCheck className="h-3.5 w-3.5 mx-auto text-cyan-500 mb-1" />
              <p className="text-lg font-bold text-cyan-500">{autoStats.smsSent}</p>
              <p className="text-[9px] text-muted-foreground">SMS Sent</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <DollarSign className="h-3.5 w-3.5 mx-auto text-emerald-500 mb-1" />
              <p className="text-lg font-bold text-emerald-500">{autoStats.paymentLinksSent}</p>
              <p className="text-[9px] text-muted-foreground">Payment Links</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <CheckCircle className="h-3.5 w-3.5 mx-auto text-green-500 mb-1" />
              <p className="text-lg font-bold text-green-600">{autoStats.successCount}</p>
              <p className="text-[9px] text-muted-foreground">Success</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <XCircle className="h-3.5 w-3.5 mx-auto text-red-500 mb-1" />
              <p className="text-lg font-bold text-red-500">{autoStats.failCount}</p>
              <p className="text-[9px] text-muted-foreground">Failed</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <Flame className="h-3.5 w-3.5 mx-auto text-orange-500 mb-1" />
              <p className="text-lg font-bold text-orange-500">{autoStats.triggerCounts.hot_lead || 0}</p>
              <p className="text-[9px] text-muted-foreground">Hot Leads</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <RefreshCw className="h-3.5 w-3.5 mx-auto text-amber-500 mb-1" />
              <p className="text-lg font-bold text-amber-500">{autoStats.triggerCounts.stale_lead || 0}</p>
              <p className="text-[9px] text-muted-foreground">Re-engaged</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <Clock className="h-3.5 w-3.5 mx-auto text-purple-500 mb-1" />
              <p className="text-lg font-bold text-purple-500">{autoStats.pendingFollowups}</p>
              <p className="text-[9px] text-muted-foreground">Queued</p>
            </div>
          </div>

          {/* Execution Pipeline Flow */}
          <div className="border rounded-lg p-3 mb-4 bg-muted/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">⚡ Execution Pipeline</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[
                { label: "Lead In", icon: "🎯", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
                { label: "→", icon: "", color: "text-muted-foreground" },
                { label: "Orchestrator", icon: "🧠", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
                { label: "→", icon: "", color: "text-muted-foreground" },
                { label: "AI Script", icon: "✍️", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
                { label: "→", icon: "", color: "text-muted-foreground" },
                { label: "Call / SMS", icon: "📞", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
                { label: "→", icon: "", color: "text-muted-foreground" },
                { label: "Fallback", icon: "🔄", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
                { label: "→", icon: "", color: "text-muted-foreground" },
                { label: "Memory", icon: "💾", color: "bg-green-500/10 text-green-600 border-green-500/20" },
                { label: "→", icon: "", color: "text-muted-foreground" },
                { label: "Close", icon: "💰", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
              ].map((step, i) =>
                step.icon ? (
                  <span key={i} className={cn("text-[10px] font-medium px-2 py-1 rounded-md border whitespace-nowrap", step.color)}>
                    {step.icon} {step.label}
                  </span>
                ) : (
                  <span key={i} className="text-xs text-muted-foreground">→</span>
                )
              )}
            </div>
          </div>

          {/* Live execution feed */}
          <div className="border-t pt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Live Execution Feed</p>
            <ScrollArea className="h-[140px]">
              <div className="space-y-1.5">
                {recentLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No execution activity yet — engine is ready</p>
                ) : recentLogs.slice(0, 15).map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[9px] px-1.5",
                        log.action_taken?.includes("call") ? "border-blue-500/30 text-blue-600" :
                        log.action_taken?.includes("sms") ? "border-cyan-500/30 text-cyan-600" :
                        log.action_taken?.includes("payment") ? "border-green-500/30 text-green-600" :
                        log.trigger_type === "hot_lead" ? "border-orange-500/30 text-orange-600" :
                        log.trigger_type === "stale_lead" ? "border-amber-500/30 text-amber-600" :
                        "border-muted-foreground/30"
                      )}>
                        {log.action_taken?.includes("executed_") ? log.action_taken.replace("executed_", "⚡ ") : log.action_taken}
                      </Badge>
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {log.trigger_type} → {log.result === "success" ? "✅" : log.result === "failed" ? "❌" : "⏳"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* ── Personality Evolution Panel ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Dna className="h-4 w-4 text-fuchsia-500" /> Personality Evolution Engine
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {evoDash?.rankings?.length || 0} ranked
              </Badge>
              <Badge className="text-[10px] bg-fuchsia-500/10 text-fuchsia-600 border-0">
                {evoDash?.evolutions?.length || 0} evolutions
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1"
                onClick={() => runEvolution.mutate()}
                disabled={runEvolution.isPending}
              >
                <Sparkles className="h-3 w-3" />
                {runEvolution.isPending ? "Evolving…" : "Run Cycle"}
              </Button>
            </div>
          </div>

          {/* Evolution Pipeline */}
          <div className="border rounded-lg p-3 mb-4 bg-muted/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🧬 Evolution Pipeline</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[
                { label: "Track Metrics", icon: "📊", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
                { label: "→" },
                { label: "Evaluate", icon: "⚖️", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
                { label: "→" },
                { label: "Rank", icon: "🏆", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
                { label: "→" },
                { label: "Evolve Winners", icon: "🧬", color: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20" },
                { label: "→" },
                { label: "Breed New", icon: "🤖", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
                { label: "→" },
                { label: "A/B Test", icon: "🔬", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
                { label: "→" },
                { label: "Retire Losers", icon: "💀", color: "bg-red-500/10 text-red-600 border-red-500/20" },
              ].map((step, i) =>
                step.icon ? (
                  <span key={i} className={cn("text-[10px] font-medium px-2 py-1 rounded-md border whitespace-nowrap", step.color)}>
                    {step.icon} {step.label}
                  </span>
                ) : (
                  <span key={i} className="text-xs text-muted-foreground">→</span>
                )
              )}
            </div>
          </div>

          {/* Rankings + Evolution Log */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Rankings */}
            <div className="border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🏆 Personality Rankings</p>
              <ScrollArea className="h-[180px]">
                <div className="space-y-1.5">
                  {!evoDash?.rankings?.length ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No rankings yet — run an evolution cycle</p>
                  ) : evoDash.rankings.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-1.5 bg-muted/30 rounded text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground w-5 text-center">
                          {r.rank_position <= 3 ? ["🥇", "🥈", "🥉"][r.rank_position - 1] : `#${r.rank_position}`}
                        </span>
                        <div>
                          <p className="font-medium">{r.brandaro_personalities?.name || "Unknown"}</p>
                          <p className="text-[9px] text-muted-foreground">{r.brandaro_personalities?.tone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[9px]",
                          r.tier === "scaling" ? "border-green-500/30 text-green-600" :
                          r.tier === "optimizing" ? "border-blue-500/30 text-blue-600" :
                          r.tier === "retired" ? "border-red-500/30 text-red-600" :
                          "border-amber-500/30 text-amber-600"
                        )}>
                          {r.tier}
                        </Badge>
                        <span className="text-[10px] font-semibold tabular-nums">{Number(r.composite_score || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Evolution Log */}
            <div className="border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🧬 Evolution History</p>
              <ScrollArea className="h-[180px]">
                <div className="space-y-1.5">
                  {!evoDash?.evolutions?.length ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No evolutions yet</p>
                  ) : evoDash.evolutions.map((e: any) => (
                    <div key={e.id} className="p-1.5 bg-muted/30 rounded text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={cn("text-[9px]",
                            e.evolution_type === "crossover" ? "border-fuchsia-500/30 text-fuchsia-600" :
                            e.evolution_type === "enhancement" ? "border-green-500/30 text-green-600" :
                            "border-blue-500/30 text-blue-600"
                          )}>
                            {e.evolution_type}
                          </Badge>
                          <span className="font-medium">{e.brandaro_personalities?.name || "New"}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(e.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {e.reason && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{e.reason}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Active A/B Tests */}
          {evoDash?.tests?.length > 0 && (
            <div className="border-t pt-3 mt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🔬 Active A/B Tests</p>
              <div className="space-y-1.5">
                {evoDash.tests.filter((t: any) => t.status === "running").slice(0, 3).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                    <span className="font-medium">{t.personality_a?.name} vs {t.personality_b?.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">{t.conversions_a} conv</span>
                      <span className="text-muted-foreground">vs</span>
                      <span className="text-blue-600">{t.conversions_b} conv</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ REVENUE AUTOPILOT ═══════ */}
      <Card className="col-span-full border-2 border-emerald-500/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-emerald-500" />
              <h2 className="font-bold text-lg">💰 REVENUE AUTOPILOT</h2>
              <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px]">CLOSED LOOP</Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-emerald-500/30 text-emerald-600"
              onClick={() => runAutopilot.mutate()}
              disabled={runAutopilot.isPending}
            >
              {runAutopilot.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Rocket className="h-3 w-3 mr-1" />}
              Run Cycle
            </Button>
          </div>

          {/* Autopilot Loop Visualization */}
          <div className="flex items-center justify-center gap-1 text-[10px] font-medium mb-4 flex-wrap">
            {["Traffic", "Leads", "AI Calls", "AI Closing", "Revenue", "Reinvest"].map((step, i) => (
              <div key={step} className="flex items-center gap-1">
                <span className={cn(
                  "px-2 py-1 rounded",
                  i === 4 ? "bg-emerald-500/20 text-emerald-700" :
                  i === 5 ? "bg-amber-500/20 text-amber-700" :
                  "bg-muted text-muted-foreground"
                )}>{step}</span>
                {i < 5 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
            <ArrowRight className="h-3 w-3 text-emerald-500" />
            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-700">↻ LOOP</span>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Total Revenue</p>
              <p className="text-xl font-bold text-emerald-600">${(autopilot.totalRevenue / 1000).toFixed(1)}k</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Overall ROI</p>
              <p className={cn("text-xl font-bold", autopilot.overallROI > 0 ? "text-emerald-600" : "text-red-500")}>
                {autopilot.overallROI.toFixed(0)}%
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Reinvest Rate</p>
              <p className="text-xl font-bold text-amber-600">{autopilot.reinvestmentRate}%</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">MRR</p>
              <p className="text-xl font-bold text-blue-600">${(autopilot.monthlyRecurring / 1000).toFixed(1)}k</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Channel Performance */}
            <div className="border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">📊 Channel ROI</p>
              <div className="space-y-1.5">
                {autopilot.channels.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No attribution data yet</p>
                ) : autopilot.channels.slice(0, 6).map((ch) => (
                  <div key={ch.name} className="flex items-center justify-between p-1.5 bg-muted/30 rounded text-xs">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium capitalize">{ch.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{ch.leads} leads</span>
                      <span className="text-emerald-600 font-medium">${ch.revenue.toFixed(0)}</span>
                      <Badge variant="outline" className={cn("text-[9px]",
                        ch.roi > 100 ? "border-emerald-500/30 text-emerald-600" :
                        ch.roi > 0 ? "border-blue-500/30 text-blue-600" :
                        "border-red-500/30 text-red-600"
                      )}>
                        {ch.roi.toFixed(0)}% ROI
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scaling Actions + Reinvestment Cycles */}
            <div className="space-y-3">
              <div className="border rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">⚡ Scaling Actions</p>
                <ScrollArea className="h-[100px]">
                  <div className="space-y-1.5">
                    {autopilot.scalingActions.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No actions yet</p>
                    ) : autopilot.scalingActions.slice(0, 8).map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between p-1.5 bg-muted/30 rounded text-xs">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={cn("text-[9px]",
                            a.action_type === "scale_up" ? "border-emerald-500/30 text-emerald-600" :
                            a.action_type === "kill" ? "border-red-500/30 text-red-600" :
                            "border-blue-500/30 text-blue-600"
                          )}>
                            {a.action_type === "scale_up" ? "↑ SCALE" : a.action_type === "kill" ? "✕ KILL" : a.action_type}
                          </Badge>
                          <span className="truncate max-w-[120px]">{a.target_campaign}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{a.roi_at_decision?.toFixed(0)}% ROI</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="border rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🔄 Reinvestment Cycles</p>
                <div className="space-y-1.5">
                  {autopilot.cycles.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No cycles run yet</p>
                  ) : autopilot.cycles.slice(0, 4).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-1.5 bg-muted/30 rounded text-xs">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="h-3 w-3 text-amber-500" />
                        <span className="font-medium">Cycle #{c.cycle_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600">${Number(c.reinvestment_amount).toFixed(0)} reinvested</span>
                        <span className="text-muted-foreground">
                          ↑{c.campaigns_scaled} ✕{c.campaigns_killed}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 🌍 GLOBAL SCALING COMMAND ── */}
      <Card className="border-cyan-500/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-cyan-500" />
              <h2 className="font-bold text-lg">🌍 Global Scaling Command</h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-cyan-500/30 text-cyan-600 hover:bg-cyan-500/10"
              onClick={() => runGlobalCycle.mutate()}
              disabled={runGlobalCycle.isPending}
            >
              {runGlobalCycle.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
              Run Global Cycle
            </Button>
          </div>

          {/* Global KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Territories</p>
              <p className="text-xl font-bold text-cyan-500">{globalDash?.global?.totalTerritories || 0}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Active</p>
              <p className="text-xl font-bold text-emerald-500">{globalDash?.global?.activeCount || 0}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Total Revenue</p>
              <p className="text-xl font-bold text-amber-500">${(globalDash?.global?.totalRevenue || 0).toLocaleString()}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Avg ROI</p>
              <p className="text-xl font-bold text-purple-500">{(globalDash?.global?.avgROI || 0).toFixed(0)}%</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Total Leads</p>
              <p className="text-xl font-bold text-blue-500">{(globalDash?.global?.totalLeads || 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Territory Map */}
            <div className="md:col-span-2 border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🗺️ Active Territories</p>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {(!globalDash?.territories || globalDash.territories.length === 0) ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No territories yet — launch your first market</p>
                  ) : globalDash.territories.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-cyan-500" />
                        <div>
                          <p className="text-sm font-medium">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground">{t.city}{t.state ? `, ${t.state}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-[9px]",
                          t.status === "scaling" ? "border-emerald-500/30 text-emerald-600" :
                          t.status === "active" ? "border-blue-500/30 text-blue-600" :
                          t.status === "testing" ? "border-amber-500/30 text-amber-600" :
                          t.status === "paused" ? "border-red-500/30 text-red-600" :
                          "border-muted-foreground/30"
                        )}>
                          {t.status?.toUpperCase()}
                        </Badge>
                        <span className="text-xs font-medium">${Number(t.latest_revenue || 0).toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground">{Number(t.latest_roi || 0).toFixed(0)}% ROI</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Expansion Suggestions */}
            <div className="border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🚀 Expansion Opportunities</p>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {(!globalDash?.suggestions || globalDash.suggestions.length === 0) ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Run a cycle to discover opportunities</p>
                  ) : globalDash.suggestions.map((s: any) => (
                    <div key={s.id} className="p-2 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <MapPinPlus className="h-3 w-3 text-cyan-500" />
                          <span className="text-xs font-medium">{s.suggested_city}{s.suggested_state ? `, ${s.suggested_state}` : ""}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] border-cyan-500/30 text-cyan-600">
                          {Number(s.similarity_score || 0).toFixed(0)}% match
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{s.reason}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Recent Actions */}
          {globalDash?.recentActions && globalDash.recentActions.length > 0 && (
            <div className="border rounded-lg p-3 mt-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">⚡ Scaling Actions</p>
              <div className="flex flex-wrap gap-1.5">
                {globalDash.recentActions.slice(0, 6).map((a: any) => (
                  <Badge key={a.id} variant="outline" className="text-[9px]">
                    {a.action_type}: {(a.details as any)?.territory || (a.details as any)?.name || "system"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Competitor Takeover Panel ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Swords className="h-4 w-4 text-red-500" /> Competitor Takeover Command
            </h3>
            <div className="flex items-center gap-2">
              <Badge className="text-[10px] bg-red-500/10 text-red-600 border-0">
                {compDash?.stats?.totalCompetitors || 0} tracked
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => runCompetitorCycle.mutate()}
                disabled={runCompetitorCycle.isPending}
              >
                <Swords className="h-3 w-3" /> {runCompetitorCycle.isPending ? "Running…" : "Run Cycle"}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <Eye className="h-3.5 w-3.5 mx-auto text-red-500 mb-1" />
              <p className="text-xl font-bold text-red-500">{compDash?.stats?.totalCompetitors || 0}</p>
              <p className="text-[9px] text-muted-foreground">Competitors Tracked</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <Crosshair className="h-3.5 w-3.5 mx-auto text-orange-500 mb-1" />
              <p className="text-xl font-bold text-orange-500">{compDash?.stats?.totalCaptured || 0}</p>
              <p className="text-[9px] text-muted-foreground">Leads Captured</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <DollarSign className="h-3.5 w-3.5 mx-auto text-green-500 mb-1" />
              <p className="text-xl font-bold text-green-500">${(compDash?.stats?.totalRevenue || 0).toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground">Revenue Captured</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <Target className="h-3.5 w-3.5 mx-auto text-purple-500 mb-1" />
              <p className="text-xl font-bold text-purple-500">{compDash?.stats?.avgWinRate || 0}%</p>
              <p className="text-[9px] text-muted-foreground">Avg Win Rate</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Competitors */}
            <div className="border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🎯 Competitor Intel</p>
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {(!compDash?.competitors || compDash.competitors.length === 0) ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No competitors tracked yet</p>
                  ) : compDash.competitors.slice(0, 8).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-xs font-medium">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(c.weaknesses || []).length} weaknesses</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-600">
                        {c.source}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Weaknesses */}
            <div className="border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">⚡ Exploitable Weaknesses</p>
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {(!compDash?.weaknesses || compDash.weaknesses.length === 0) ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Run a cycle to discover weaknesses</p>
                  ) : compDash.weaknesses.slice(0, 8).map((w: any) => (
                    <div key={w.id} className="p-2 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{w.weakness_type?.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className={cn("text-[9px]",
                          Number(w.exploitability_score) >= 85 ? "border-red-500/30 text-red-600" : "border-amber-500/30 text-amber-600"
                        )}>
                          {w.exploitability_score}% exploit
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{w.exploit_strategy}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Counter-Offers */}
            <div className="border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">💰 Active Counter-Offers</p>
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {(!compDash?.offers || compDash.offers.length === 0) ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No counter-offers generated yet</p>
                  ) : compDash.offers.slice(0, 8).map((o: any) => (
                    <div key={o.id} className="p-2 bg-muted/30 rounded-lg">
                      <p className="text-xs font-medium">{o.strategy?.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{o.brandaro_counter_offer}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-muted-foreground">{o.times_used || 0}x used</span>
                        <span className="text-[9px] font-medium text-green-600">{o.conversion_rate || 0}% conv</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
