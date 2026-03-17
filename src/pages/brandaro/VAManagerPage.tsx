import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useAllVAPerformance, useVALeaderboard, useVAAlerts, useAddCoachingNote,
} from "@/hooks/useBrandaroVAPerformance";
import { toast } from "sonner";
import {
  Users, Phone, TrendingUp, Target, Flame, Clock, AlertTriangle,
  Trophy, Shield, Star, Eye, MessageSquare, CheckCircle2,
} from "lucide-react";

export default function VAManagerPage() {
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"today" | "week" | "month">("today");
  const [selectedVA, setSelectedVA] = useState<string | null>(null);
  const [coachingNotes, setCoachingNotes] = useState("");
  const [qualityScore, setQualityScore] = useState("3");
  const [improvementTarget, setImprovementTarget] = useState("");

  const { data: allPerf = [] } = useAllVAPerformance();
  const { data: leaderboard = [] } = useVALeaderboard(leaderboardPeriod);
  const { data: alerts = [] } = useVAAlerts();
  const addCoaching = useAddCoachingNote();

  const totalCalls = allPerf.reduce((s: number, p: any) => s + (p.calls_made || 0), 0);
  const totalConversations = allPerf.reduce((s: number, p: any) => s + (p.conversations || 0), 0);
  const totalInterested = allPerf.reduce((s: number, p: any) => s + (p.interested_leads || 0), 0);
  const totalHot = allPerf.reduce((s: number, p: any) => s + (p.hot_leads || 0), 0);
  const onShift = allPerf.filter((p: any) => p.is_on_shift).length;
  const behindQuota = allPerf.filter((p: any) => {
    const callPct = p.quota_calls > 0 ? p.calls_made / p.quota_calls : 1;
    return callPct < 0.5;
  });

  const submitCoaching = () => {
    if (!selectedVA || !coachingNotes) return;
    addCoaching.mutate({
      va_user_id: selectedVA,
      notes: coachingNotes,
      quality_score: parseInt(qualityScore),
      improvement_target: improvementTarget || undefined,
    });
    setCoachingNotes("");
    setImprovementTarget("");
    toast.success("Coaching note added");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manager Oversight</h1>
        <p className="text-muted-foreground text-sm">VA team performance and operations control</p>
      </div>

      {/* Critical Alerts */}
      {alerts.filter((a: any) => a.severity === "critical" || a.severity === "high").length > 0 && (
        <div className="space-y-2">
          {alerts.filter((a: any) => a.severity === "critical" || a.severity === "high").slice(0, 5).map((a: any) => (
            <div key={a.id} className="rounded-lg px-4 py-2 text-sm flex items-center gap-2 bg-destructive/20 text-destructive border border-destructive/30">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{a.title}</span>
              {a.description && <span className="text-xs opacity-80">— {a.description}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Team Overview KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "VAs On Shift", val: onShift, icon: Users, color: "text-green-500" },
          { label: "Total Calls", val: totalCalls, icon: Phone, color: "text-primary" },
          { label: "Conversations", val: totalConversations, icon: TrendingUp, color: "text-cyan-500" },
          { label: "Interested", val: totalInterested, icon: Target, color: "text-blue-500" },
          { label: "Hot Leads", val: totalHot, icon: Flame, color: "text-orange-500" },
          { label: "Behind Quota", val: behindQuota.length, icon: AlertTriangle, color: behindQuota.length > 0 ? "text-destructive" : "text-muted-foreground" },
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

      <Tabs defaultValue="team" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="team"><Users className="h-3 w-3 mr-1" /> Team Status</TabsTrigger>
          <TabsTrigger value="leaderboard"><Trophy className="h-3 w-3 mr-1" /> Leaderboard</TabsTrigger>
          <TabsTrigger value="coaching"><Shield className="h-3 w-3 mr-1" /> Coaching</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="h-3 w-3 mr-1" /> Alerts ({alerts.length})</TabsTrigger>
        </TabsList>

        {/* Team Status */}
        <TabsContent value="team">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">VA Team — Today's Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {allPerf.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No VA activity today</p>}
                  {allPerf.map((va: any) => {
                    const callPct = va.quota_calls > 0 ? Math.round((va.calls_made / va.quota_calls) * 100) : 0;
                    const convPct = va.quota_conversations > 0 ? Math.round((va.conversations / va.quota_conversations) * 100) : 0;
                    return (
                      <div key={va.id} className="p-4 rounded-lg border bg-card space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${va.is_on_shift ? "bg-green-500" : "bg-muted-foreground"}`} />
                            <span className="font-medium text-sm">{va.va_user_id.slice(0, 8)}…</span>
                            <Badge variant={va.is_on_shift ? "default" : "secondary"} className="text-xs">
                              {va.is_on_shift ? "On Shift" : "Off Shift"}
                            </Badge>
                          </div>
                          <Badge variant="outline">{va.performance_score} pts</Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div><p className="font-bold text-lg">{va.calls_made}</p><p className="text-muted-foreground">Calls</p></div>
                          <div><p className="font-bold text-lg">{va.conversations}</p><p className="text-muted-foreground">Convos</p></div>
                          <div><p className="font-bold text-lg">{va.interested_leads}</p><p className="text-muted-foreground">Interested</p></div>
                          <div><p className="font-bold text-lg">{va.hot_leads}</p><p className="text-muted-foreground">Hot Leads</p></div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Calls</span>
                            <span className={callPct >= 100 ? "text-green-500" : callPct < 50 ? "text-destructive" : ""}>{callPct}%</span>
                          </div>
                          <Progress value={Math.min(100, callPct)} className="h-1.5" />
                          <div className="flex justify-between text-xs">
                            <span>Conversations</span>
                            <span className={convPct >= 100 ? "text-green-500" : convPct < 50 ? "text-destructive" : ""}>{convPct}%</span>
                          </div>
                          <Progress value={Math.min(100, convPct)} className="h-1.5" />
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedVA(va.va_user_id)}>
                            <Eye className="h-3 w-3 mr-1" /> Review
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelectedVA(va.va_user_id); }}>
                            <MessageSquare className="h-3 w-3 mr-1" /> Coach
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

        {/* Leaderboard */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Team Leaderboard</CardTitle>
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
                      <span className={`text-lg font-bold w-8 ${i === 0 ? "text-amber-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-700" : "text-muted-foreground"}`}>
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
        </TabsContent>

        {/* Coaching */}
        <TabsContent value="coaching">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Add Coaching Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedVA || ""} onValueChange={setSelectedVA}>
                <SelectTrigger><SelectValue placeholder="Select VA…" /></SelectTrigger>
                <SelectContent>
                  {allPerf.map((va: any) => (
                    <SelectItem key={va.va_user_id} value={va.va_user_id}>
                      {va.va_user_id.slice(0, 8)}… — {va.calls_made} calls
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Textarea placeholder="Coaching notes…" value={coachingNotes} onChange={e => setCoachingNotes(e.target.value)} />

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Quality Score (1-5)</label>
                  <Select value={qualityScore} onValueChange={setQualityScore}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} {n === 5 ? "★" : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Improvement Target</label>
                  <Input value={improvementTarget} onChange={e => setImprovementTarget(e.target.value)} placeholder="e.g. Objection handling" />
                </div>
              </div>

              <Button onClick={submitCoaching} disabled={!selectedVA || !coachingNotes}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Submit Coaching Note
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {alerts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No active alerts</p>}
                  {alerts.map((a: any) => (
                    <div key={a.id} className={`p-3 rounded-lg border flex items-start gap-3 ${
                      a.severity === "critical" ? "border-destructive/50 bg-destructive/5" :
                      a.severity === "high" ? "border-orange-500/30 bg-orange-500/5" :
                      "bg-card"
                    }`}>
                      <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                        a.severity === "critical" ? "text-destructive" :
                        a.severity === "high" ? "text-orange-500" : "text-muted-foreground"
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">{a.severity}</Badge>
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
