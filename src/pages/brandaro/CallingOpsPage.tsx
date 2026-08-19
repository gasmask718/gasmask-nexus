import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { readEdgeError } from "@/lib/edgeError";
import {
  Phone, PhoneOff, Users, Clock, TrendingUp, RefreshCw,
  AlertTriangle, BarChart3, Shield, MapPin, Zap, CheckCircle2,
  XCircle, PhoneForwarded, Bell, MessageSquare, Loader2,
  Brain, Target, Trophy, ArrowUpRight, DollarSign, Flame, Activity
} from "lucide-react";
import { useScriptPerformance, useLeadPerformanceStats } from "@/hooks/useBrandaroIntelligence";
import {
  useConversionPredictions, usePredictionStats, useNichePerformance,
  useRevenueStats, useRunPredictiveScoring, useUpdateNiches
} from "@/hooks/useBrandaroPredictive";
import {
  useExecutionQueue, useExecutionQueueStats, usePopulateQueue, useRunExecutionWorker
} from "@/hooks/useBrandaroExecutionQueue";
import {
  useNumberPool,
  useNumberAlerts,
  useNumberAnalytics,
  useAssignNumber,
  useLogCallOutcome,
} from "@/hooks/useBrandaroNumberPool";
import { BrandaroAiCallHistoryTable } from "@/components/brandaro/BrandaroAiCallHistoryTable";

const EXCLUDED_STATUSES = ["sold", "wrong_number", "not_interested", "do_not_call"];

const OUTCOME_OPTIONS = [
  { value: "no_answer", label: "No Answer", color: "secondary" },
  { value: "interested", label: "Interested", color: "default" },
  { value: "not_interested", label: "Not Interested", color: "destructive" },
  { value: "callback", label: "Call Back Later", color: "outline" },
  { value: "do_not_call", label: "Do Not Call", color: "destructive" },
] as const;

export default function CallingOpsPage() {
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [callNotes, setCallNotes] = useState("");
  const [assignedNumber, setAssignedNumber] = useState<any>(null);
  const [dialingId, setDialingId] = useState<string | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);

  const assignNumber = useAssignNumber();
  const logOutcome = useLogCallOutcome();
  const { data: analytics } = useNumberAnalytics();
  const { data: alerts = [] } = useNumberAlerts();
  const { data: scriptPerf = [] } = useScriptPerformance();
  const { data: leadPerfStats } = useLeadPerformanceStats();
  const { data: predictions = [] } = useConversionPredictions();
  const { data: predStats } = usePredictionStats();
  const { data: nichePerf = [] } = useNichePerformance();
  const { data: revenueStats } = useRevenueStats();
  const runScoring = useRunPredictiveScoring();
  const updateNiches = useUpdateNiches();
  const { data: execQueue = [] } = useExecutionQueue();
  const { data: execStats } = useExecutionQueueStats();
  const populateQueue = usePopulateQueue();
  const runWorker = useRunExecutionWorker();

  const { data: queueItems = [], isLoading: queueLoading } = useQuery({
    queryKey: ["brandaro-call-queue", selectedCampaign],
    queryFn: async () => {
      let query = supabase
        .from("brandaro_call_queue")
        .select(`
          *,
          brandaro_qualified_leads!inner(
            business_name, phone_number, city, state, industry, rating, review_count, lead_status
          )
        `)
        .eq("is_active", true)
        .order("priority_tier", { ascending: true })
        .order("priority_score", { ascending: false })
        .order("next_call_time", { ascending: true })
        .limit(100);

      if (selectedCampaign !== "all") {
        query = query.eq("campaign_id", selectedCampaign);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["brandaro-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Today's stats — SOURCE OF TRUTH: brandaro_ai_calls
  // A row is written BEFORE dispatch, so row count = attempts, not outcomes.
  // These tiles count outcomes; attempts are shown separately with the
  // failure rate, so a 100% dispatch failure can never read as healthy volume.
  const { data: todayStats } = useQuery({
    queryKey: ["brandaro-ai-calls-stats-today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("brandaro_ai_calls")
        .select("status, outcome, interest_level, duration_seconds")
        .gte("created_at", today);
      if (error) throw error;
      const rows = data || [];
      const attempted = rows.length;
      const failed = rows.filter((r: any) => {
        const s = String(r.status || "").toLowerCase();
        return ["failed", "error", "rejected", "canceled", "cancelled"].includes(s);
      }).length;
      const answered = rows.filter((r: any) =>
        ["completed", "connected", "answered", "in-progress"].includes(String(r.status || "").toLowerCase())
      ).length;
      const dispatched = attempted - failed;
      const interested = rows.filter((r: any) => {
        const o = String(r.outcome || "").toLowerCase();
        const i = String(r.interest_level || "").toLowerCase();
        return ["interested", "hot", "hot_lead", "booked", "callback"].includes(o) || ["hot", "warm", "high"].includes(i);
      }).length;
      const demoTriggered = rows.filter((r: any) => {
        const o = String(r.outcome || "").toLowerCase();
        return o.includes("demo");
      }).length;
      const conversations = rows.filter((r: any) => (r.duration_seconds || 0) > 20).length;
      return {
        attempted,
        dispatched,
        failed,
        failureRate: attempted ? Math.round((failed / attempted) * 100) : 0,
        total: dispatched, // legacy field: now outcomes, not attempts
        answered,
        interested,
        demoTriggered,
        conversations,
      };
    },

    refetchInterval: 30000,
  });


  // Auto-Striker metrics
  const { data: autoStrikerStats } = useQuery({
    queryKey: ["brandaro-auto-striker-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await (supabase as any)
        .from("brandaro_auto_actions")
        .select("action_type, status")
        .gte("created_at", today);
      const actions = data || [];
      return {
        totalActions: actions.length,
        callsTriggered: actions.filter((a: any) => a.action_type === "ai_call" && a.status === "success").length,
        smsSent: actions.filter((a: any) => (a.action_type === "sms" || a.action_type === "follow_up_sms") && a.status === "success").length,
        failed: actions.filter((a: any) => a.status === "failed").length,
        skipped: actions.filter((a: any) => a.status === "skipped").length,
      };
    },
    refetchInterval: 15000,
  });

  const { data: callbacks = [] } = useQuery({
    queryKey: ["brandaro-callbacks-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_callbacks")
        .select(`*, brandaro_qualified_leads(business_name, phone_number)`)
        .eq("status", "pending")
        .order("scheduled_time", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const populateQueueMutation = useMutation({
    mutationFn: async () => {
      const { data: leads, error: leadsErr } = await supabase
        .from("brandaro_qualified_leads")
        .select("id, priority_tier, priority_score, lead_status, call_attempts")
        .not("lead_status", "in", `(${EXCLUDED_STATUSES.join(",")})`)
        .order("priority_score", { ascending: false })
        .limit(200);
      if (leadsErr) throw leadsErr;
      if (!leads?.length) throw new Error("No eligible leads found");

      const existingIds = new Set(queueItems.map((q: any) => q.lead_id));
      const newLeads = leads.filter(l => !existingIds.has(l.id));
      if (!newLeads.length) throw new Error("All eligible leads are already in queue");

      const queueRows = newLeads.map((lead, idx) => ({
        lead_id: lead.id,
        priority_tier: lead.priority_tier === "1" ? 1 : lead.priority_tier === "2" ? 2 : 3,
        priority_score: lead.priority_score || 50,
        queue_position: idx + 1,
        retry_count: lead.call_attempts || 0,
      }));

      const { error } = await supabase.from("brandaro_call_queue").insert(queueRows);
      if (error) throw error;
      return newLeads.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} leads added to queue`);
      queryClient.invalidateQueries({ queryKey: ["brandaro-call-queue"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePrepareCall = async (item: any) => {
    const lead = item.brandaro_qualified_leads;
    setActiveLeadId(item.id);
    setCallNotes("");
    setAssignedNumber(null);

    try {
      const result = await assignNumber.mutateAsync({
        target_phone: lead.phone_number,
        target_state: lead.state,
      });
      setAssignedNumber(result);
      toast.success(
        result.area_code_matched
          ? `✅ Local number matched (${result.number.area_code})`
          : `📞 Number assigned (${result.number.area_code} → target ${result.target_area_code})`
      );
    } catch {
      // error handled by hook
    }
  };

  const handleLogOutcome = async (item: any, outcome: string) => {
    const lead = item.brandaro_qualified_leads;
    await logOutcome.mutateAsync({
      number_id: assignedNumber?.number?.id,
      lead_phone: lead.phone_number,
      lead_name: lead.business_name,
      lead_location: `${lead.city}, ${lead.state}`,
      area_code_matched: assignedNumber?.area_code_matched,
      outcome,
      notes: callNotes || undefined,
    });
    setActiveLeadId(null);
    setAssignedNumber(null);
    setCallNotes("");
    queryClient.invalidateQueries({ queryKey: ["brandaro-call-queue"] });
  };

  // ── LIVE DIAL via Twilio ──
  const handleLiveDial = async (item: any) => {
    const lead = item.brandaro_qualified_leads;
    if (!lead?.phone_number) {
      toast.error("No phone number for this lead");
      return;
    }
    setDialingId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke('brandaro-closer-action', {
        body: {
          action: 'call',
          phone: lead.phone_number,
          lead_id: item.lead_id || item.id,
        },
      });
      // Surface the provider's real failure instead of the generic non-2xx text.
      if (error) throw new Error(await readEdgeError(error, 'Call failed'));
      if (!data?.success) throw new Error(data?.error || 'Call failed');
      if (!data?.result?.sid) throw new Error('Call was not accepted by the carrier (no call SID returned)');
      toast.success(`📞 Call initiated to ${lead.business_name}`);
      // Update queue item status
      await (supabase as any).from("brandaro_call_queue").update({ updated_at: new Date().toISOString() }).eq("id", item.id);
      queryClient.invalidateQueries({ queryKey: ["brandaro-call-queue"] });
    } catch (err: any) {
      console.error('[CallingOps] live dial failed:', err);
      toast.error(`Call failed: ${err.message}`, { duration: 8000 });
    } finally {
      setDialingId(null);
    }
  };


  // ── QUICK SMS from queue ──
  const handleQuickSms = async (item: any) => {
    const lead = item.brandaro_qualified_leads;
    if (!lead?.phone_number) {
      toast.error("No phone number for this lead");
      return;
    }
    setSendingSmsId(item.id);
    try {
      const message = `Hi! This is Brandaro Digital. We noticed ${lead.business_name || 'your business'} could benefit from a professional website. Want to see a free demo? Reply YES!`;
      const { data, error } = await supabase.functions.invoke('brandaro-closer-action', {
        body: {
          action: 'sms',
          phone: lead.phone_number,
          message,
          lead_id: item.lead_id || item.id,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'SMS failed');
      toast.success(`💬 SMS sent to ${lead.business_name}`);
    } catch (err: any) {
      toast.error(`SMS failed: ${err.message}`);
    } finally {
      setSendingSmsId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📞 Calling Operations Hub</h1>
          <p className="text-muted-foreground">Number Intelligence + VA Calling Desk</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => populateQueueMutation.mutate()} disabled={populateQueueMutation.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Populate Queue
          </Button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-destructive animate-pulse" />
              <span className="font-semibold text-sm">{alerts.length} Number Alert(s)</span>
            </div>
            {alerts.slice(0, 3).map((a: any) => (
              <p key={a.id} className="text-xs text-muted-foreground">
                {a.brandaro_number_pool?.phone_number}: {a.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className={todayStats?.failed ? "border-destructive/50" : undefined}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{todayStats?.dispatched || 0}</p>
                <p className="text-xs text-muted-foreground">
                  Dialed Today · {todayStats?.attempted || 0} attempted
                </p>
                {!!todayStats?.failed && (
                  <p className="text-xs font-medium text-destructive">
                    {todayStats.failed} failed to dispatch ({todayStats.failureRate}%)
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{todayStats?.answered || 0}</p>
                <p className="text-xs text-muted-foreground">Answered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{todayStats?.demoTriggered || 0}</p>
                <p className="text-xs text-muted-foreground">Demo Triggered</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-2xl font-bold">{todayStats?.interested || 0}</p>
                <p className="text-xs text-muted-foreground">Interested</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{queueItems.length}</p>
                <p className="text-xs text-muted-foreground">In Queue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{analytics?.active || 0}/{analytics?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Numbers Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-Striker Stats */}
      {autoStrikerStats && autoStrikerStats.totalActions > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Auto-Striker Today</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-xl font-bold">{autoStrikerStats.totalActions}</p>
                <p className="text-xs text-muted-foreground">Total Actions</p>
              </div>
              <div>
                <p className="text-xl font-bold text-primary">{autoStrikerStats.callsTriggered}</p>
                <p className="text-xs text-muted-foreground">AI Calls</p>
              </div>
              <div>
                <p className="text-xl font-bold text-cyan-500">{autoStrikerStats.smsSent}</p>
                <p className="text-xs text-muted-foreground">SMS Sent</p>
              </div>
              <div>
                <p className="text-xl font-bold text-destructive">{autoStrikerStats.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div>
                <p className="text-xl font-bold text-muted-foreground">{autoStrikerStats.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="execution" className="space-y-4">
        <div className="w-full overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="execution">⚔️ Execution</TabsTrigger>
            <TabsTrigger value="history">📜 Call History</TabsTrigger>
            <TabsTrigger value="desk">VA Calling Desk</TabsTrigger>
            <TabsTrigger value="predictive">🔮 Predictive</TabsTrigger>
            <TabsTrigger value="intelligence">🧠 Intelligence</TabsTrigger>
            <TabsTrigger value="numbers">Number Pool</TabsTrigger>
            <TabsTrigger value="analytics">Number Analytics</TabsTrigger>
          </TabsList>
        </div>



        {/* ── AUTO EXECUTION ENGINE ── */}
        <TabsContent value="execution" className="space-y-4">
          {/* Controls */}
          <div className="flex gap-3">
            <Button onClick={() => populateQueue.mutate()} disabled={populateQueue.isPending} variant="outline">
              {populateQueue.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Target className="h-4 w-4 mr-2" />}
              Populate Queue from Predictions
            </Button>
            <Button onClick={() => runWorker.mutate()} disabled={runWorker.isPending} className="bg-primary">
              {runWorker.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Execute Now
            </Button>
            <Button onClick={() => runScoring.mutate()} disabled={runScoring.isPending} variant="outline">
              {runScoring.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
              Re-Score Leads
            </Button>
          </div>

          {/* Queue Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Pending", value: execStats?.pending || 0, icon: Clock, color: "text-amber-500" },
              { label: "Completed", value: execStats?.completed || 0, icon: CheckCircle2, color: "text-emerald-500" },
              { label: "Failed", value: execStats?.failed || 0, icon: XCircle, color: "text-destructive" },
              { label: "Exhausted", value: execStats?.exhausted || 0, icon: PhoneOff, color: "text-muted-foreground" },
              { label: "Total Queued", value: execStats?.total || 0, icon: Activity, color: "text-primary" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <div>
                      <p className="text-xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Priority Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-destructive/30">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-destructive">{execStats?.highPriority || 0}</p>
                <p className="text-xs text-muted-foreground">🔴 High → Auto Call</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{execStats?.mediumPriority || 0}</p>
                <p className="text-xs text-muted-foreground">🟡 Medium → SMS First</p>
              </CardContent>
            </Card>
            <Card className="border-muted">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-muted-foreground">{execStats?.lowPriority || 0}</p>
                <p className="text-xs text-muted-foreground">⚪ Low → Nurture</p>
              </CardContent>
            </Card>
          </div>

          {/* Live Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Execution Queue
              </CardTitle>
              <CardDescription>Actions auto-dispatched based on priority tier — high calls, medium SMS, low nurture</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prob</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Next</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {execQueue.slice(0, 40).map((q: any) => {
                    const lead = q.brandaro_qualified_leads;
                    return (
                      <TableRow key={q.id}>
                        <TableCell>
                          <Badge variant={q.conversion_probability >= 70 ? "default" : q.conversion_probability >= 40 ? "secondary" : "outline"}>
                            {Number(q.conversion_probability).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={q.priority_tier === "high" ? "destructive" : q.priority_tier === "medium" ? "default" : "secondary"}>
                            {q.priority_tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{q.action_strategy?.replace(/_/g, " ")}</TableCell>
                        <TableCell className="font-medium">{lead?.business_name || "—"}</TableCell>
                        <TableCell className="text-xs">{lead?.industry || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={
                            q.status === "completed" ? "default" :
                            q.status === "pending" ? "secondary" :
                            q.status === "exhausted" ? "outline" : "destructive"
                          }>
                            {q.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{q.attempts}/{q.max_attempts}</TableCell>
                        <TableCell className="text-xs">
                          {q.next_attempt_at ? new Date(q.next_attempt_at).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {execQueue.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                        Queue empty — click "Populate Queue from Predictions" to load leads
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CALL HISTORY (brandaro_ai_calls SOURCE OF TRUTH) ── */}
        <TabsContent value="history" className="space-y-4">
          <BrandaroAiCallHistoryTable />
        </TabsContent>

        {/* ── VA CALLING DESK ── */}
        <TabsContent value="desk" className="space-y-4">
          {/* Callbacks */}
          {callbacks.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Pending Callbacks ({callbacks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {callbacks.slice(0, 5).map((cb: any) => (
                    <div key={cb.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{cb.brandaro_qualified_leads?.business_name}</span>
                      <span className="text-muted-foreground">
                        {new Date(cb.scheduled_time).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filter */}
          <div className="flex gap-4 items-center">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Call Card */}
          {activeLeadId && (() => {
            const item = queueItems.find((q: any) => q.id === activeLeadId);
            if (!item) return null;
            const lead = item.brandaro_qualified_leads;
            return (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PhoneForwarded className="h-5 w-5 text-primary animate-pulse" />
                    Active Call — {lead.business_name}
                  </CardTitle>
                  <CardDescription>
                    {lead.city}, {lead.state} · {lead.industry || "Unknown"} · ⭐ {lead.rating || "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Assigned Number */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                    <Phone className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {assignedNumber
                          ? `Calling from: ${assignedNumber.number.phone_number}`
                          : "Assigning number..."}
                      </p>
                      {assignedNumber && (
                        <div className="flex items-center gap-2 mt-1">
                          {assignedNumber.area_code_matched ? (
                            <Badge variant="default" className="text-xs">
                              <MapPin className="h-3 w-3 mr-1" /> Local Match
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Regional ({assignedNumber.number.area_code} → {assignedNumber.target_area_code})
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {assignedNumber.number.provider} · Risk {assignedNumber.number.risk_score}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {assignedNumber.number.daily_call_count}/75 today
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lead Contact */}
                  <div className="p-3 rounded-lg bg-background border">
                    <p className="text-sm"><strong>Lead Phone:</strong> {lead.phone_number}</p>
                    <p className="text-sm"><strong>Reviews:</strong> {lead.review_count || 0} · <strong>Status:</strong> {lead.lead_status}</p>
                  </div>

                  {/* Notes */}
                  <Textarea
                    placeholder="Call notes..."
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    rows={2}
                  />

                  {/* Outcome Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {OUTCOME_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={opt.color as any}
                        onClick={() => handleLogOutcome(item, opt.value)}
                        disabled={logOutcome.isPending}
                      >
                        {opt.value === "interested" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {opt.value === "not_interested" && <XCircle className="h-3 w-3 mr-1" />}
                        {opt.label}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setActiveLeadId(null); setAssignedNumber(null); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Queue Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Dialing Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <p className="text-muted-foreground">Loading queue...</p>
              ) : queueItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <PhoneOff className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Queue is empty. Click "Populate Queue" to load qualified leads.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier</TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueItems.map((item: any) => {
                      const lead = item.brandaro_qualified_leads;
                      const isActive = activeLeadId === item.id;
                      return (
                        <TableRow key={item.id} className={isActive ? "bg-primary/5" : ""}>
                          <TableCell>
                            <Badge variant={item.priority_tier === 1 ? "destructive" : item.priority_tier === 2 ? "default" : "secondary"}>
                              T{item.priority_tier}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{lead?.business_name}</TableCell>
                          <TableCell>{lead?.industry || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {lead?.city}, {lead?.state}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{lead?.phone_number}</TableCell>
                          <TableCell>{item.retry_count}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={isActive ? "secondary" : "default"}
                                onClick={() => handlePrepareCall(item)}
                                disabled={isActive || assignNumber.isPending}
                              >
                                <Zap className="h-3 w-3 mr-1" />
                                {isActive ? "Active" : "Prepare"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLiveDial(item)}
                                disabled={dialingId === item.id || !lead?.phone_number}
                              >
                                {dialingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleQuickSms(item)}
                                disabled={sendingSmsId === item.id || !lead?.phone_number}
                              >
                                {sendingSmsId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PREDICTIVE ENGINE ── */}
        <TabsContent value="predictive" className="space-y-4">
          {/* Controls */}
          <div className="flex gap-2">
            <Button onClick={() => runScoring.mutate()} disabled={runScoring.isPending}>
              <Activity className="h-4 w-4 mr-2" />
              {runScoring.isPending ? "Scoring..." : "Run Predictive Scoring"}
            </Button>
            <Button variant="outline" onClick={() => updateNiches.mutate()} disabled={updateNiches.isPending}>
              <Flame className="h-4 w-4 mr-2" />
              Update Niches
            </Button>
          </div>

          {/* Prediction Distribution */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Total Scored", value: predStats?.total || 0, icon: Target },
              { label: "High Priority", value: predStats?.high || 0, icon: Flame },
              { label: "Medium", value: predStats?.medium || 0, icon: Activity },
              { label: "Low", value: predStats?.low || 0, icon: Clock },
              { label: "Avg Probability", value: `${predStats?.avgProb || 0}%`, icon: Brain },
              { label: "Converted", value: predStats?.converted || 0, icon: Trophy },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Revenue Summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-3xl font-bold text-primary">${(revenueStats?.totalRevenue || 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Trophy className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-3xl font-bold">{revenueStats?.totalDeals || 0}</p>
                <p className="text-sm text-muted-foreground">Deals Closed</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by Script */}
          {revenueStats?.byScript && Object.keys(revenueStats.byScript).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue by Script Variant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(revenueStats.byScript).map(([variant, amount]) => (
                    <div key={variant} className="flex justify-between items-center">
                      <Badge>{variant}</Badge>
                      <span className="font-bold text-primary">${Number(amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Priority Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Predictive Priority Queue
              </CardTitle>
              <CardDescription>Leads ranked by conversion probability — take action on high-priority first</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prob</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Factors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.slice(0, 30).map((p: any) => {
                    const lead = p.brandaro_qualified_leads;
                    const factorKeys = Object.keys(p.scoring_factors || {});
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Badge variant={p.conversion_probability >= 70 ? "default" : p.conversion_probability >= 40 ? "secondary" : "outline"}>
                            {Number(p.conversion_probability).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.priority_tier === "high" ? "destructive" : p.priority_tier === "medium" ? "default" : "secondary"}>
                            {p.priority_tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{p.action_strategy?.replace(/_/g, " ")}</TableCell>
                        <TableCell className="font-medium">{lead?.business_name || "—"}</TableCell>
                        <TableCell className="text-xs">{lead?.industry || "—"}</TableCell>
                        <TableCell className="text-xs">{lead?.city}, {lead?.state}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {factorKeys.slice(0, 3).map(k => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k.replace(/_/g, " ")} +{(p.scoring_factors as any)[k]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {predictions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        No predictions yet — click "Run Predictive Scoring" to analyze leads
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Hot Niches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5" />
                Niche Performance
              </CardTitle>
              <CardDescription>Industries ranked by revenue per lead — hot niches get auto-scaled</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Industry</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Contacted</TableHead>
                    <TableHead>Replied</TableHead>
                    <TableHead>Converted</TableHead>
                    <TableHead>Conv Rate</TableHead>
                    <TableHead>RPL</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nichePerf.map((n: any) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium capitalize">{n.industry}</TableCell>
                      <TableCell>{n.total_leads}</TableCell>
                      <TableCell>{n.total_contacted}</TableCell>
                      <TableCell>{n.total_replied}</TableCell>
                      <TableCell>{n.total_converted}</TableCell>
                      <TableCell>
                        <Badge variant={n.conversion_rate > 10 ? "default" : "outline"}>
                          {Number(n.conversion_rate).toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold">${Number(n.revenue_per_lead).toFixed(0)}</TableCell>
                      <TableCell>${Number(n.total_revenue).toLocaleString()}</TableCell>
                      <TableCell>
                        {n.is_hot_niche ? (
                          <Badge variant="destructive"><Flame className="h-3 w-3 mr-1" />HOT</Badge>
                        ) : (
                          <Badge variant="secondary">Normal</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {nichePerf.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                        No niche data yet — click "Update Niches" after leads are processed
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── INTELLIGENCE ENGINE ── */}
        <TabsContent value="intelligence" className="space-y-4">
          {/* Conversion Funnel */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Tracked", value: leadPerfStats?.totalTracked || 0, icon: Target },
              { label: "SMS Replied", value: leadPerfStats?.smsReplied || 0, icon: MessageSquare },
              { label: "Calls Answered", value: leadPerfStats?.callsAnswered || 0, icon: Phone },
              { label: "Interested", value: leadPerfStats?.interested || 0, icon: ArrowUpRight },
              { label: "Converted", value: leadPerfStats?.converted || 0, icon: Trophy },
              { label: "Avg Score", value: leadPerfStats?.avgScore || 0, icon: Brain },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Rates */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-4xl font-bold text-primary">{leadPerfStats?.replyRate || 0}%</p>
                <p className="text-sm text-muted-foreground">Reply Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-4xl font-bold text-primary">{leadPerfStats?.conversionRate || 0}%</p>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Script A/B Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Script A/B Performance
              </CardTitle>
              <CardDescription>Auto-optimizing — winner gets more weight after 50+ sends</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sends</TableHead>
                    <TableHead>Replies</TableHead>
                    <TableHead>Reply Rate</TableHead>
                    <TableHead>Conversions</TableHead>
                    <TableHead>Conv Rate</TableHead>
                    <TableHead>Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scriptPerf.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Badge variant={v.usage_weight >= 60 ? "default" : "secondary"}>
                          {v.variant_key} {v.usage_weight >= 60 && "👑"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{v.variant_label || v.script_type}</TableCell>
                      <TableCell>{v.send_count}</TableCell>
                      <TableCell>{v.reply_count}</TableCell>
                      <TableCell>
                        <Badge variant={v.reply_rate > 10 ? "default" : "outline"}>
                          {Number(v.reply_rate).toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{v.conversion_count}</TableCell>
                      <TableCell>{Number(v.conversion_rate).toFixed(1)}%</TableCell>
                      <TableCell>
                        <span className={v.usage_weight >= 60 ? "font-bold text-primary" : "text-muted-foreground"}>
                          {Number(v.usage_weight).toFixed(0)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {scriptPerf.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                        No script data yet — actions will populate automatically
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Scored Leads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Top Scored Leads
              </CardTitle>
              <CardDescription>Highest engagement + response signals</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>SMS</TableHead>
                    <TableHead>Replied</TableHead>
                    <TableHead>Call</TableHead>
                    <TableHead>Interested</TableHead>
                    <TableHead>Converted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(leadPerfStats?.topLeads || []).map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Badge variant={l.lead_score >= 50 ? "default" : "secondary"}>
                          {l.lead_score}
                        </Badge>
                      </TableCell>
                      <TableCell>{l.sms_sent}</TableCell>
                      <TableCell>{l.sms_replied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : "—"}</TableCell>
                      <TableCell>{l.call_picked_up ? <CheckCircle2 className="h-4 w-4 text-primary" /> : "—"}</TableCell>
                      <TableCell>{l.interested ? <CheckCircle2 className="h-4 w-4 text-primary" /> : "—"}</TableCell>
                      <TableCell>{l.converted ? <Trophy className="h-4 w-4 text-primary" /> : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NUMBER POOL ── */}
        <TabsContent value="numbers" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-emerald-500">{analytics?.active || 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{analytics?.cooldown || 0}</p>
                <p className="text-xs text-muted-foreground">Cooldown</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-destructive">{analytics?.flagged || 0}</p>
                <p className="text-xs text-muted-foreground">Flagged</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Numbers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Area Code</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Today</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(analytics?.allNumbers || []).map((n: any) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-mono text-sm">{n.phone_number}</TableCell>
                      <TableCell>
                        <Badge variant={n.provider === "twilio" ? "default" : "secondary"}>
                          {n.provider}
                        </Badge>
                      </TableCell>
                      <TableCell>{n.area_code}</TableCell>
                      <TableCell>{n.state || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            n.status === "active" ? "default" :
                            n.status === "cooldown" ? "secondary" : "destructive"
                          }
                        >
                          {n.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={n.daily_call_count >= 70 ? "text-destructive font-bold" : ""}>
                          {n.daily_call_count}/75
                        </span>
                      </TableCell>
                      <TableCell>{n.total_calls}</TableCell>
                      <TableCell>
                        <span className={n.risk_score > 10 ? "text-destructive" : "text-muted-foreground"}>
                          {n.risk_score}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!analytics?.allNumbers?.length) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No numbers in pool. Add Twilio or Google Voice numbers to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NUMBER ANALYTICS ── */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🏆 Top Performing Numbers</CardTitle>
              <CardDescription>Ranked by answer rate</CardDescription>
            </CardHeader>
            <CardContent>
              {(analytics?.topPerformers || []).length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No call data yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Area Code</TableHead>
                      <TableHead>Total Calls</TableHead>
                      <TableHead>Answered</TableHead>
                      <TableHead>Answer Rate</TableHead>
                      <TableHead>Conversions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(analytics?.topPerformers || []).map((n: any) => {
                      const rate = n.total_calls > 0 ? ((n.total_answered / n.total_calls) * 100).toFixed(1) : "0";
                      return (
                        <TableRow key={n.id}>
                          <TableCell className="font-mono">{n.phone_number}</TableCell>
                          <TableCell>{n.area_code}</TableCell>
                          <TableCell>{n.total_calls}</TableCell>
                          <TableCell>{n.total_answered}</TableCell>
                          <TableCell>
                            <Badge variant={Number(rate) > 50 ? "default" : "secondary"}>{rate}%</Badge>
                          </TableCell>
                          <TableCell className="font-bold">{n.total_conversions}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
