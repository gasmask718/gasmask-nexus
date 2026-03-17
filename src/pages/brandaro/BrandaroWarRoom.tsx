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
  RefreshCw, MailCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCloserKPIs } from "@/hooks/useBrandaroCloserAI";
import { useBrandaroAutomationStats } from "@/hooks/useBrandaroAutomation";
import { useClosingPsychologyStats } from "@/hooks/useBrandaroClosingPsychology";

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
    </div>
  );
}
