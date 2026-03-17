import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMyDailyPerformance, useVATaskQueue, useCompleteVATask, useSkipVATask,
  useVALeaderboard, useVABadges, useVACoaching, useVAAlerts, useToggleShift,
} from "@/hooks/useBrandaroVAPerformance";
import { toast } from "sonner";
import {
  Phone, TrendingUp, Target, Flame, Clock, CheckCircle2,
  SkipForward, AlertTriangle, Award, Zap, Bell, Power,
  MessageSquare, Calendar, Star, Trophy, Shield,
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

export default function VADashboardPage() {
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"today" | "week" | "month">("today");
  const { data: perf } = useMyDailyPerformance();
  const { data: tasks = [] } = useVATaskQueue();
  const { data: leaderboard = [] } = useVALeaderboard(leaderboardPeriod);
  const { data: badges = [] } = useVABadges();
  const { data: coaching = [] } = useVACoaching();
  const { data: alerts = [] } = useVAAlerts();
  const completeTask = useCompleteVATask();
  const skipTask = useSkipVATask();
  const toggleShift = useToggleShift();

  const quotaProgress = (actual: number, target: number) =>
    target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;

  const urgentTasks = tasks.filter((t: any) => t.priority >= 8 || t.status === "overdue");
  const callbackTasks = tasks.filter((t: any) => t.task_type === "scheduled_callback");
  const regularTasks = tasks.filter((t: any) => !urgentTasks.includes(t) && !callbackTasks.includes(t));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">VA Sales Floor</h1>
          <p className="text-muted-foreground text-sm">Your daily execution dashboard</p>
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

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((a: any) => (
            <div
              key={a.id}
              className={`rounded-lg px-4 py-2 text-sm flex items-center gap-2 ${
                a.severity === "critical" ? "bg-destructive/20 text-destructive border border-destructive/30" :
                a.severity === "high" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{a.title}</span>
              {a.description && <span className="text-xs opacity-80">— {a.description}</span>}
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
          { label: "Demo Requests", val: perf?.demo_requests || 0, icon: Calendar, color: "text-purple-400" },
          { label: "Callbacks Set", val: perf?.callbacks_booked || 0, icon: Clock, color: "text-yellow-500" },
          { label: "No Answers", val: perf?.no_answers || 0, icon: Phone, color: "text-muted-foreground" },
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
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="tasks" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Tasks {urgentTasks.length > 0 && `(${urgentTasks.length})`}
          </TabsTrigger>
          <TabsTrigger value="callbacks" className="gap-1">
            <Clock className="h-3 w-3" /> Callbacks {callbackTasks.length > 0 && `(${callbackTasks.length})`}
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-1">
            <Trophy className="h-3 w-3" /> Leaderboard
          </TabsTrigger>
          <TabsTrigger value="coaching" className="gap-1">
            <Shield className="h-3 w-3" /> Coaching
          </TabsTrigger>
        </TabsList>

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
                {leaderboard.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No leaderboard data yet</p>}
                {leaderboard.map((va: any, i: number) => (
                  <div key={va.va_user_id} className={`flex items-center justify-between p-3 rounded-lg border ${i === 0 ? "border-amber-500/30 bg-amber-500/5" : "bg-card"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-700" : "text-muted-foreground"}`}>
                        #{i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{va.name}</p>
                      </div>
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

          {/* Badges */}
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
                      {c.strengths?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.strengths.map((s: string) => <Badge key={s} variant="secondary" className="text-xs text-green-500">{s}</Badge>)}
                        </div>
                      )}
                      {c.weak_points?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.weak_points.map((w: string) => <Badge key={w} variant="secondary" className="text-xs text-destructive">{w}</Badge>)}
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
