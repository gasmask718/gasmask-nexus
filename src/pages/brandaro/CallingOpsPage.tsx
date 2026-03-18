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
import {
  Phone, PhoneOff, Users, Clock, TrendingUp, RefreshCw,
  AlertTriangle, BarChart3, Shield, MapPin, Zap, CheckCircle2,
  XCircle, PhoneForwarded, Bell, MessageSquare, Loader2
} from "lucide-react";
import {
  useNumberPool,
  useNumberAlerts,
  useNumberAnalytics,
  useAssignNumber,
  useLogCallOutcome,
} from "@/hooks/useBrandaroNumberPool";

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

  const { data: todayStats } = useQuery({
    queryKey: ["brandaro-call-stats-today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("brandaro_call_logs")
        .select("call_outcome")
        .gte("call_timestamp", today);
      if (error) throw error;
      const total = data?.length || 0;
      const interested = data?.filter(d => d.call_outcome === "interested" || d.call_outcome === "hot_lead").length || 0;
      const conversations = data?.filter(d => !["no_answer", "wrong_number"].includes(d.call_outcome)).length || 0;
      return { total, interested, conversations };
    },
  });

  const { data: callbacks = [] } = useQuery({
    queryKey: ["brandaro-callbacks-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_callbacks")
        .select(`*, brandaro_qualified_leads(business_name, phone)`)
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{todayStats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Calls Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{todayStats?.conversations || 0}</p>
                <p className="text-xs text-muted-foreground">Conversations</p>
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

      <Tabs defaultValue="desk" className="space-y-4">
        <TabsList>
          <TabsTrigger value="desk">VA Calling Desk</TabsTrigger>
          <TabsTrigger value="numbers">Number Pool</TabsTrigger>
          <TabsTrigger value="analytics">Number Analytics</TabsTrigger>
        </TabsList>

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
                            <Button
                              size="sm"
                              variant={isActive ? "secondary" : "default"}
                              onClick={() => handlePrepareCall(item)}
                              disabled={isActive || assignNumber.isPending}
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              {isActive ? "Active" : "Call"}
                            </Button>
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
