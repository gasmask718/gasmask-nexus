import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  useMyDailyPerformance, useVATaskQueue, useCompleteVATask, useSkipVATask,
  useVALeaderboard, useVABadges, useVACoaching, useVAAlerts, useToggleShift,
} from "@/hooks/useBrandaroVAPerformance";
import {
  useVACallSessions, useCreateCallSession, useEndCallSession, useAnalyzeCallSession,
  useVALeadHeat, useVARecommendations, useApplyRecommendation,
  useVAConversionMetrics, useVACloserHandoffs,
} from "@/hooks/useBrandaroCloserBrain";
import { useBrandaroLiveScript, type LiveResponse } from "@/hooks/useBrandaroLiveScript";
import { toast } from "sonner";
import {
  Phone, TrendingUp, Target, Flame, Clock, CheckCircle2,
  SkipForward, AlertTriangle, Award, Zap, Bell, Power,
  MessageSquare, Calendar, Star, Trophy, Shield, Brain,
  ArrowUpRight, Eye, Sparkles, Send, ThermometerSun, Mic,
} from "lucide-react";

const TASK_ICONS: Record<string, any> = {
  call_new_lead: Phone,
  reattempt_no_answer: Phone,
  scheduled_callback: Clock,
  send_followup_sms: MessageSquare,
  send_demo_reminder: Calendar,
  push_demo_viewed: Target,
  escalate_hot_lead: Flame,
  payment_reminder: Zap,
  default: CheckCircle2,
};

const HEAT_COLORS: Record<string, string> = {
  closing_now: "text-red-500 bg-red-500/10 border-red-500/30",
  hot: "text-orange-500 bg-orange-500/10 border-orange-500/30",
  interested: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  warming: "text-cyan-500 bg-cyan-500/10 border-cyan-500/30",
  cold: "text-muted-foreground bg-muted/20 border-muted/30",
};

export default function VADashboardPage() {
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"today" | "week" | "month">("today");
  const [callNotes, setCallNotes] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const { data: perf } = useMyDailyPerformance();
  const { data: tasks = [] } = useVATaskQueue();
  const { data: leaderboard = [] } = useVALeaderboard(leaderboardPeriod);
  const { data: todayBoard = [] } = useVALeaderboard("today");
  const { data: monthBoard = [] } = useVALeaderboard("month");
  const { data: lastMonthBoard = [] } = useVALeaderboard("last_month");
  const { data: badges = [] } = useVABadges();
  const { data: coaching = [] } = useVACoaching();
  const { data: alerts = [] } = useVAAlerts();
  const completeTask = useCompleteVATask();
  const skipTask = useSkipVATask();
  const toggleShift = useToggleShift();

  const { data: callSessions = [] } = useVACallSessions();
  const { data: hotLeads = [] } = useVALeadHeat("hot");
  const { data: recommendations = [] } = useVARecommendations();
  const { data: convMetrics } = useVAConversionMetrics("today");
  const { data: handoffs = [] } = useVACloserHandoffs();
  const createSession = useCreateCallSession();
  const endSession = useEndCallSession();
  const analyzeCall = useAnalyzeCallSession();
  const applyRec = useApplyRecommendation();
  const { analyzeChunk, resetSession: resetLiveScript, isAnalyzing: isLiveAnalyzing, lastResponse: liveResponse, responseHistory, contextMemory } = useBrandaroLiveScript();
  const [liveTranscript, setLiveTranscript] = useState("");
  const quotaProgress = (actual: number, target: number) =>
    target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;

  const urgentTasks = tasks.filter((t: any) => t.priority >= 8 || t.status === "overdue");
  const callbackTasks = tasks.filter((t: any) => t.task_type === "scheduled_callback");
  const regularTasks = tasks.filter((t: any) => !urgentTasks.includes(t) && !callbackTasks.includes(t));
  const closingNowLeads = hotLeads.filter((l: any) => l.status === "closing_now");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">VA Sales Floor</h1>
          <p className="text-muted-foreground text-sm">AI-Powered Closer Brain Active</p>
        </div>
        <div className="flex items-center gap-3">
          {alerts.length > 0 && (
            <Badge variant="destructive" className="animate-pulse gap-1">
              <Bell className="h-3 w-3" /> {alerts.length} alerts
            </Badge>
          )}
          <Button
            size="sm"
            variant={perf?.is_on_shift ? "destructive" : "default"}
            onClick={() => {
              toggleShift.mutate(!perf?.is_on_shift);
              toast.success(perf?.is_on_shift ? "Shift ended" : "Shift started");
            }}
          >
            <Power className="h-4 w-4 mr-1" />
            {perf?.is_on_shift ? "End Shift" : "Start Shift"}
          </Button>
        </div>
      </div>

      {/* Hot Lead Banners */}
      {closingNowLeads.length > 0 && (
        <div className="space-y-2">
          {closingNowLeads.slice(0, 2).map((lead: any) => (
            <div key={lead.id} className="rounded-lg px-4 py-3 bg-red-500/15 border border-red-500/40 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3">
                <Flame className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-bold text-red-400">🔥 CLOSING NOW — Score: {Math.round(lead.heat_score)}</p>
                  <p className="text-xs text-red-300/80">Action: {lead.next_best_action?.replace(/_/g, " ")}</p>
                </div>
              </div>
              <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Alert Banners */}
      {alerts.length > 0 && closingNowLeads.length === 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((a: any) => (
            <div key={a.id} className={`rounded-lg px-4 py-2 text-sm flex items-center gap-2 ${
              a.severity === "critical" ? "bg-destructive/20 text-destructive border border-destructive/30" :
              a.severity === "high" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
              "bg-primary/10 text-primary border border-primary/20"
            }`}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{a.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Calls Made", val: perf?.calls_made || 0, icon: Phone, color: "text-primary" },
          { label: "Conversations", val: perf?.conversations || 0, icon: TrendingUp, color: "text-green-500" },
          { label: "Interested", val: perf?.interested_leads || 0, icon: Target, color: "text-cyan-500" },
          { label: "Hot Leads", val: perf?.hot_leads || 0, icon: Flame, color: "text-orange-500" },
          { label: "Objections Handled", val: convMetrics?.objections_handled || 0, icon: Shield, color: "text-purple-400" },
          { label: "Buying Signals", val: convMetrics?.buying_signals_detected || 0, icon: Sparkles, color: "text-emerald-400" },
          { label: "Closer Handoffs", val: convMetrics?.closer_handoffs || 0, icon: ArrowUpRight, color: "text-amber-400" },
          { label: "Score", val: perf?.performance_score || 0, icon: Star, color: "text-amber-400" },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
                <div>
                  <p className="text-2xl font-bold">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quota Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quota Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Calls", actual: perf?.calls_made || 0, target: perf?.quota_calls || 75 },
            { label: "Conversations", actual: perf?.conversations || 0, target: perf?.quota_conversations || 20 },
            { label: "Interested", actual: perf?.interested_leads || 0, target: perf?.quota_interested || 5 },
            { label: "Demos", actual: perf?.demo_requests || 0, target: perf?.quota_demos || 2 },
          ].map(({ label, actual, target }) => {
            const pct = quotaProgress(actual, target);
            return (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className={pct >= 100 ? "text-green-500 font-bold" : pct >= 60 ? "text-primary" : "text-destructive"}>
                    {actual}/{target} ({pct}%)
                  </span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="ai-brain" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="ai-brain" className="gap-1">
            <Brain className="h-3 w-3" /> AI Brain
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Tasks {urgentTasks.length > 0 && `(${urgentTasks.length})`}
          </TabsTrigger>
          <TabsTrigger value="callbacks" className="gap-1">
            <Clock className="h-3 w-3" /> Callbacks
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-1">
            <Trophy className="h-3 w-3" /> Rank
          </TabsTrigger>
          <TabsTrigger value="coaching" className="gap-1">
            <Shield className="h-3 w-3" /> Coach
          </TabsTrigger>
        </TabsList>

        {/* AI Brain Tab */}
        <TabsContent value="ai-brain" className="space-y-4">
          {/* Call Intelligence Card */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Live Call Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!activeSessionId ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Start a call session to get real-time AI analysis</p>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const session = await createSession.mutateAsync({ source: "va_dashboard" });
                      setActiveSessionId(session.id);
                      toast.success("Call session started");
                    }}
                  >
                    <Phone className="h-3 w-3 mr-1" /> Start Call Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium text-green-500">Session Active</span>
                  </div>
                  <Textarea
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Paste transcript or type call notes here…&#10;&#10;Example: Lead said 'how much does it cost?' and 'can I see examples?' — seemed interested but mentioned budget concerns."
                    className="min-h-[100px] text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        analyzeCall.mutate({
                          call_session_id: activeSessionId,
                          notes: callNotes,
                        });
                      }}
                      disabled={!callNotes.trim() || analyzeCall.isPending}
                    >
                      <Sparkles className="h-3 w-3" />
                      {analyzeCall.isPending ? "Analyzing…" : "Analyze Call"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        endSession.mutate({ sessionId: activeSessionId });
                        setActiveSessionId(null);
                        setCallNotes("");
                        resetLiveScript();
                        toast("Session ended");
                      }}
                    >
                      End Session
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* LIVE SCRIPT ENGINE — Real-Time AI Closer */}
          {activeSessionId && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mic className="h-4 w-4 text-amber-400 animate-pulse" /> Live Script Engine
                  {isLiveAnalyzing && <Badge variant="outline" className="text-xs animate-pulse">Thinking…</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Live transcript input */}
                <div className="flex gap-2">
                  <Textarea
                    value={liveTranscript}
                    onChange={(e) => setLiveTranscript(e.target.value)}
                    placeholder="Type what the lead just said…"
                    className="min-h-[60px] text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-auto gap-1"
                    disabled={!liveTranscript.trim() || isLiveAnalyzing}
                    onClick={async () => {
                      await analyzeChunk({
                        transcript_chunk: liveTranscript,
                        call_session_id: activeSessionId,
                      });
                      setLiveTranscript("");
                    }}
                  >
                    <Send className="h-3 w-3" />
                    Get Response
                  </Button>
                </div>

                {/* AI Response Card */}
                {liveResponse && (
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    {/* Detected Signals */}
                    <div className="flex flex-wrap gap-2">
                      {liveResponse.detected_objection !== "none" && (
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">
                          ⚠ {liveResponse.detected_objection.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {liveResponse.detected_signal !== "none" && (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                          ✓ {liveResponse.detected_signal.replace(/_/g, " ")}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${
                        liveResponse.mood === "positive" || liveResponse.mood === "ready_to_close" ? "text-emerald-400" :
                        liveResponse.mood === "resistant" || liveResponse.mood === "skeptical" ? "text-red-400" : ""
                      }`}>
                        {liveResponse.mood.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {liveResponse.strategy_used.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {liveResponse.confidence_score}% confident
                      </Badge>
                    </div>

                    {/* The Response */}
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-sm font-medium leading-relaxed">
                        💬 "{liveResponse.response_text}"
                      </p>
                    </div>

                    {/* Close Alert */}
                    {liveResponse.should_close_now && (
                      <div className="rounded-lg px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-bold text-emerald-400">
                          🎯 CLOSE NOW → {liveResponse.close_type?.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}

                    {/* Escalation Alert */}
                    {liveResponse.escalation_needed && (
                      <div className="rounded-lg px-3 py-2 bg-red-500/15 border border-red-500/30 flex items-center gap-2 animate-pulse">
                        <Flame className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-bold text-red-400">
                          🔥 ESCALATE TO CLOSER IMMEDIATELY
                        </span>
                      </div>
                    )}

                    {/* Heat Delta */}
                    {liveResponse.heat_delta !== 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <ThermometerSun className="h-3 w-3" />
                        <span className={liveResponse.heat_delta > 0 ? "text-emerald-400" : "text-red-400"}>
                          {liveResponse.heat_delta > 0 ? "+" : ""}{liveResponse.heat_delta} heat
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Response History */}
                {responseHistory.length > 1 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Response History ({responseHistory.length})
                    </summary>
                    <ScrollArea className="h-[150px] mt-2">
                      <div className="space-y-1.5">
                        {[...responseHistory].reverse().slice(1).map((r, i) => (
                          <div key={i} className="p-2 rounded border bg-muted/30 text-xs">
                            <div className="flex gap-1 mb-1">
                              {r.detected_objection !== "none" && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 text-red-400">⚠ {r.detected_objection.replace(/_/g, " ")}</Badge>
                              )}
                              {r.detected_signal !== "none" && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 text-emerald-400">✓ {r.detected_signal.replace(/_/g, " ")}</Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground italic">"{r.response_text}"</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </details>
                )}

                {/* Context Memory */}
                {(contextMemory.objections_handled.length > 0 || contextMemory.signals_detected.length > 0) && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground mr-1">Memory:</span>
                    {contextMemory.objections_handled.map((o, i) => (
                      <Badge key={`o-${i}`} variant="outline" className="text-[10px] h-4 px-1">handled: {o.replace(/_/g, " ")}</Badge>
                    ))}
                    {contextMemory.signals_detected.map((s, i) => (
                      <Badge key={`s-${i}`} variant="outline" className="text-[10px] h-4 px-1 text-emerald-400">signal: {s.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Recommendations */}
          {recommendations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" /> AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {recommendations.map((rec: any) => (
                      <div key={rec.id} className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{rec.recommendation_title}</span>
                          <Badge variant={rec.priority >= 8 ? "destructive" : "secondary"} className="text-xs">
                            P{rec.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{rec.recommendation_body}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {rec.recommended_action?.replace(/_/g, " ")}
                          </Badge>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyRec.mutate(rec.id)}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Apply
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Hot Leads */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ThermometerSun className="h-4 w-4 text-orange-500" /> Lead Heat Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {hotLeads.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No hot leads yet — keep calling!</p>}
                  {hotLeads.map((lead: any) => (
                    <div key={lead.id} className={`flex items-center justify-between p-3 rounded-lg border ${HEAT_COLORS[lead.status] || HEAT_COLORS.cold}`}>
                      <div className="flex items-center gap-3">
                        {lead.status === "closing_now" ? <Flame className="h-4 w-4 text-red-500 animate-pulse" /> :
                         lead.status === "hot" ? <Flame className="h-4 w-4 text-orange-500" /> :
                         <ThermometerSun className="h-4 w-4" />}
                        <div>
                          <p className="text-sm font-medium">Lead {lead.lead_id?.slice(0, 8)}…</p>
                          <p className="text-xs opacity-75">{lead.next_best_action?.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{Math.round(lead.heat_score)}</span>
                        <Badge variant="outline" className="text-xs capitalize">{lead.status?.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Recent Call Sessions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" /> Recent Call Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {callSessions.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No call sessions yet</p>}
                  {callSessions.slice(0, 8).map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border bg-card text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant={s.ai_analyzed ? "default" : "secondary"} className="text-xs shrink-0">
                          {s.ai_analyzed ? "Analyzed" : "Pending"}
                        </Badge>
                        <span className="truncate">{s.call_outcome || "—"}</span>
                        {s.urgency_level === "high" || s.urgency_level === "immediate" ? (
                          <Flame className="h-3 w-3 text-orange-500 shrink-0" />
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.objection_count > 0 && <Badge variant="outline" className="text-xs">{s.objection_count} obj</Badge>}
                        {s.buying_signal_count > 0 && <Badge variant="outline" className="text-xs text-green-500">{s.buying_signal_count} sig</Badge>}
                        <span className="text-muted-foreground">{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {[...urgentTasks, ...regularTasks].length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No pending tasks — great job! 🎉</p>
                  )}
                  {[...urgentTasks, ...regularTasks].map((task: any) => {
                    const Icon = TASK_ICONS[task.task_type] || TASK_ICONS.default;
                    const isOverdue = task.status === "overdue" || (task.due_at && new Date(task.due_at) < new Date());
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isOverdue ? "border-destructive/50 bg-destructive/5" :
                          task.priority >= 8 ? "border-orange-500/30 bg-orange-500/5" :
                          "bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Icon className={`h-4 w-4 shrink-0 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{task.task_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground truncate">{task.source_reason || "System generated"}</p>
                            {task.due_at && (
                              <p className={`text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                                Due: {new Date(task.due_at).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant={task.priority >= 8 ? "destructive" : "secondary"} className="text-xs">
                            P{task.priority}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              completeTask.mutate({ taskId: task.id });
                              toast.success("Task completed");
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              skipTask.mutate(task.id);
                              toast("Task skipped");
                            }}
                          >
                            <SkipForward className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Callbacks Tab */}
        <TabsContent value="callbacks">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Scheduled Callbacks</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {callbackTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No callbacks scheduled</p>
                  )}
                  {callbackTasks.map((task: any) => {
                    const isOverdue = task.due_at && new Date(task.due_at) < new Date();
                    return (
                      <div key={task.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOverdue ? "border-destructive/50 bg-destructive/5" : "bg-card"}`}>
                        <div className="flex items-center gap-3">
                          <Clock className={`h-4 w-4 ${isOverdue ? "text-destructive" : "text-yellow-500"}`} />
                          <div>
                            <p className="text-sm font-medium">Callback</p>
                            <p className="text-xs text-muted-foreground">{task.source_reason}</p>
                            {task.due_at && <p className={`text-xs ${isOverdue ? "text-destructive font-bold" : ""}`}>{new Date(task.due_at).toLocaleString()}</p>}
                          </div>
                        </div>
                        <Button size="sm" onClick={() => { completeTask.mutate({ taskId: task.id }); toast.success("Callback completed"); }}>
                          <Phone className="h-3 w-3 mr-1" /> Call
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Leaderboard</CardTitle>
              <div className="flex gap-1">
                {(["today", "week", "month"] as const).map(p => (
                  <Button key={p} size="sm" variant={leaderboardPeriod === p ? "default" : "ghost"} onClick={() => setLeaderboardPeriod(p)} className="text-xs h-7">
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
                {leaderboard.map((va: any, i: number) => (
                  <div key={va.va_user_id} className={`flex items-center justify-between p-3 rounded-lg border ${i === 0 ? "border-amber-500/30 bg-amber-500/5" : "bg-card"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-700" : "text-muted-foreground"}`}>
                        #{i + 1}
                      </span>
                      <p className="text-sm font-medium">{va.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {i === 0 && <Trophy className="h-4 w-4 text-amber-400" />}
                      <Badge variant="secondary">{va.score} pts</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {badges.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Your Badges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {badges.map((b: any) => (
                    <Badge key={b.id} variant="outline" className="gap-1 py-1">
                      <Award className="h-3 w-3 text-amber-400" />
                      {b.badge_label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Coaching Tab */}
        <TabsContent value="coaching">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Coaching Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {coaching.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No coaching notes yet</p>}
                  {coaching.map((c: any) => (
                    <div key={c.id} className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{c.coaching_type || "General"}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      {c.notes && <p className="text-sm">{c.notes}</p>}
                      {c.quality_score && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Quality:</span>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < c.quality_score ? "text-amber-400 fill-amber-400" : "text-muted"}`} />
                          ))}
                        </div>
                      )}
                      {c.improvement_target && <p className="text-xs text-muted-foreground">🎯 Target: {c.improvement_target}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
