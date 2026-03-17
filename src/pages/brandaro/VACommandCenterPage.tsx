import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Flame, Phone, Eye, FileText, Play, Pause,
  MessageSquare, Brain, Target, TrendingUp,
  UserCheck, AlertTriangle, Send, Clock,
  CheckCircle2, Star, BarChart3, Zap
} from "lucide-react";

export default function VACommandCenterPage() {
  const queryClient = useQueryClient();
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [vaNote, setVaNote] = useState("");
  const [overrideOutcome, setOverrideOutcome] = useState("");

  // ─── HOT LEADS (handoff_score > 80) ───────────────────
  const { data: hotLeads = [] } = useQuery({
    queryKey: ["brandaro-hot-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_voice_agent_calls" as any)
        .select("*, brandaro_qualified_leads:lead_id(*)")
        .gte("handoff_score", 80)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // ─── DEMO REQUESTS ───────────────────────────────────
  const { data: demoRequests = [] } = useQuery({
    queryKey: ["brandaro-demo-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_qualified_leads")
        .select("*")
        .eq("demo_status", "pending")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // ─── RECENT AI CALLS FOR REVIEW ──────────────────────
  const { data: recentCalls = [] } = useQuery({
    queryKey: ["brandaro-recent-ai-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_voice_agent_calls" as any)
        .select("*, brandaro_qualified_leads:lead_id(*)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // ─── CLOSE PIPELINE ──────────────────────────────────
  const { data: pipeline = [] } = useQuery({
    queryKey: ["brandaro-close-pipeline"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_close_pipeline")
        .select("*, brandaro_qualified_leads:lead_id(*)")
        .order("priority_score", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  // ─── FOLLOW-UP QUEUE ─────────────────────────────────
  const { data: followups = [] } = useQuery({
    queryKey: ["brandaro-pending-followups"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_followup_sequences")
        .select("*, brandaro_qualified_leads:lead_id(*)")
        .eq("status", "pending")
        .order("scheduled_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // ─── VA ACTION LOG ────────────────────────────────────
  const logVaAction = useMutation({
    mutationFn: async ({ actionType, targetCallId, targetLeadId, originalValue, newValue, notes }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await (supabase as any).from("brandaro_va_actions").insert({
        va_user_id: user.id,
        action_type: actionType,
        target_call_id: targetCallId,
        target_lead_id: targetLeadId,
        original_value: originalValue,
        new_value: newValue,
        notes,
      });
      if (error) throw error;
    },
  });

  // ─── OVERRIDE OUTCOME ────────────────────────────────
  const handleOverrideOutcome = async (call: any) => {
    if (!overrideOutcome) return;

    await logVaAction.mutateAsync({
      actionType: "override_outcome",
      targetCallId: call.id,
      targetLeadId: call.lead_id,
      originalValue: call.outcome,
      newValue: overrideOutcome,
      notes: vaNote,
    });

    await (supabase as any).from("brandaro_voice_agent_calls")
      .update({ outcome: overrideOutcome, ai_notes: `VA Override: ${vaNote}` })
      .eq("id", call.id);

    toast.success("Outcome overridden");
    setOverrideOutcome("");
    setVaNote("");
    queryClient.invalidateQueries({ queryKey: ["brandaro-recent-ai-calls"] });
  };

  // ─── TRIGGER FOLLOW-UP ───────────────────────────────
  const triggerFollowup = async (leadId: string, channel: string) => {
    await (supabase as any).from("brandaro_followup_sequences").insert({
      lead_id: leadId,
      trigger_event: "va_manual",
      channel,
      message_content: `Hi! Following up on our conversation — we've prepared something for your business. Want to take a look?`,
      scheduled_at: new Date().toISOString(),
      status: "pending",
    });

    await logVaAction.mutateAsync({
      actionType: "trigger_followup",
      targetLeadId: leadId,
      notes: `Manual ${channel} follow-up triggered`,
    });

    toast.success(`${channel.toUpperCase()} follow-up queued`);
    queryClient.invalidateQueries({ queryKey: ["brandaro-pending-followups"] });
  };

  const stageCounts = {
    demo_sent: pipeline.filter((p: any) => p.stage === "demo_sent").length,
    demo_viewed: pipeline.filter((p: any) => p.stage === "demo_viewed").length,
    interested: pipeline.filter((p: any) => p.stage === "interested").length,
    negotiating: pipeline.filter((p: any) => p.stage === "negotiating").length,
    closed: pipeline.filter((p: any) => p.stage === "closed").length,
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            VA Command Center
          </h1>
          <p className="text-sm text-muted-foreground">AI + Human Hybrid Sales Control</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1">
            <Flame className="h-3 w-3 text-orange-500" /> {hotLeads.length} Hot
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Eye className="h-3 w-3 text-blue-500" /> {demoRequests.length} Demos
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3 text-yellow-500" /> {followups.length} Follow-ups
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(stageCounts).map(([stage, count]) => (
          <Card key={stage}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground capitalize">{stage.replace("_", " ")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="hot-leads" className="space-y-3">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="hot-leads" className="gap-1 text-xs">
            <Flame className="h-3 w-3" /> Hot Leads
          </TabsTrigger>
          <TabsTrigger value="demo-requests" className="gap-1 text-xs">
            <Eye className="h-3 w-3" /> Demos
          </TabsTrigger>
          <TabsTrigger value="call-review" className="gap-1 text-xs">
            <FileText className="h-3 w-3" /> Call Review
          </TabsTrigger>
          <TabsTrigger value="follow-ups" className="gap-1 text-xs">
            <Send className="h-3 w-3" /> Follow-Ups
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1 text-xs">
            <Target className="h-3 w-3" /> Pipeline
          </TabsTrigger>
        </TabsList>

        {/* ─── HOT LEADS TAB ──────────────────────── */}
        <TabsContent value="hot-leads">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Hot Leads — Handoff Score 80+
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {hotLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No hot leads right now. AI is working on it.</p>
                ) : (
                  <div className="space-y-2">
                    {hotLeads.map((lead: any) => (
                      <Card key={lead.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{lead.brandaro_qualified_leads?.business_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">
                                {lead.brandaro_qualified_leads?.industry} · Score: {lead.handoff_score}
                              </p>
                              <p className="text-xs mt-1">
                                Stage: <Badge variant="secondary" className="text-[10px]">{lead.call_stage_reached}</Badge>
                                {lead.demo_requested && <Badge className="ml-1 text-[10px]">Demo ✓</Badge>}
                                {lead.contact_captured && <Badge variant="outline" className="ml-1 text-[10px]">Contact ✓</Badge>}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => triggerFollowup(lead.lead_id, "sms")}>
                                <MessageSquare className="h-3 w-3 mr-1" /> SMS
                              </Button>
                              <Button size="sm" onClick={() => setSelectedCall(lead)}>
                                <Phone className="h-3 w-3 mr-1" /> Call
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── DEMO REQUESTS TAB ─────────────────── */}
        <TabsContent value="demo-requests">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                Pending Demo Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {demoRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No pending demos.</p>
                ) : (
                  <div className="space-y-2">
                    {demoRequests.map((lead: any) => (
                      <Card key={lead.id}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{lead.business_name}</p>
                              <p className="text-xs text-muted-foreground">{lead.industry} · {lead.city}</p>
                              <p className="text-xs text-muted-foreground">{lead.email || lead.phone || "No contact"}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => triggerFollowup(lead.id, "sms")}>
                                <Send className="h-3 w-3 mr-1" /> Push
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => triggerFollowup(lead.id, "email")}>
                                <FileText className="h-3 w-3 mr-1" /> Email
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── CALL REVIEW TAB ───────────────────── */}
        <TabsContent value="call-review">
          <div className="grid grid-cols-2 gap-3">
            {/* Call List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">AI Call History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1">
                    {recentCalls.map((call: any) => (
                      <div
                        key={call.id}
                        className={`p-2 rounded cursor-pointer border text-sm ${selectedCall?.id === call.id ? "bg-accent border-primary" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedCall(call)}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium text-xs">
                            {call.brandaro_qualified_leads?.business_name || "Unknown"}
                          </span>
                          <Badge variant={call.outcome === "demo_requested" ? "default" : "secondary"} className="text-[10px]">
                            {call.outcome}
                          </Badge>
                        </div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground mt-1">
                          {call.ai_confidence_score != null && (
                            <span>Conf: {call.ai_confidence_score}%</span>
                          )}
                          {call.conversion_probability != null && (
                            <span>Conv: {call.conversion_probability}%</span>
                          )}
                          <span>HS: {call.handoff_score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Call Detail */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Call Detail</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedCall ? (
                  <p className="text-sm text-muted-foreground">Select a call to review</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">{selectedCall.brandaro_qualified_leads?.business_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedCall.brandaro_qualified_leads?.industry} · Duration: {selectedCall.call_duration_seconds}s
                        </p>
                      </div>

                      {/* Scores */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded bg-muted/50">
                          <div className="text-lg font-bold">{selectedCall.ai_confidence_score ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground">Confidence</div>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/50">
                          <div className="text-lg font-bold">{selectedCall.ai_control_score ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground">Control</div>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/50">
                          <div className="text-lg font-bold">{selectedCall.conversion_probability ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground">Conv %</div>
                        </div>
                      </div>

                      {/* Transcript */}
                      {selectedCall.call_transcript && (
                        <div>
                          <p className="text-xs font-medium mb-1">Transcript</p>
                          <div className="text-xs bg-muted/30 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                            {selectedCall.call_transcript}
                          </div>
                        </div>
                      )}

                      {/* Recording */}
                      {selectedCall.call_recording_url && (
                        <div>
                          <p className="text-xs font-medium mb-1">Recording</p>
                          <audio controls className="w-full h-8" src={selectedCall.call_recording_url} />
                        </div>
                      )}

                      {/* Improvements */}
                      {selectedCall.improvement_suggestions?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">AI Suggestions</p>
                          <ul className="text-xs space-y-1">
                            {selectedCall.improvement_suggestions.map((s: string, i: number) => (
                              <li key={i} className="flex gap-1">
                                <Zap className="h-3 w-3 text-yellow-500 shrink-0 mt-0.5" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* VA Override */}
                      <div className="border-t pt-2 space-y-2">
                        <p className="text-xs font-medium">VA Actions</p>
                        <Select value={overrideOutcome} onValueChange={setOverrideOutcome}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Override outcome..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="demo_requested">Demo Requested</SelectItem>
                            <SelectItem value="contact_captured">Contact Captured</SelectItem>
                            <SelectItem value="interested">Interested</SelectItem>
                            <SelectItem value="not_interested">Not Interested</SelectItem>
                            <SelectItem value="callback_needed">Callback Needed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea
                          className="text-xs h-16"
                          placeholder="VA notes..."
                          value={vaNote}
                          onChange={(e) => setVaNote(e.target.value)}
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs"
                            onClick={() => handleOverrideOutcome(selectedCall)}
                            disabled={!overrideOutcome}
                          >
                            <UserCheck className="h-3 w-3 mr-1" /> Override
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => triggerFollowup(selectedCall.lead_id, "sms")}
                          >
                            <Send className="h-3 w-3 mr-1" /> Follow-Up
                          </Button>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── FOLLOW-UPS TAB ────────────────────── */}
        <TabsContent value="follow-ups">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Pending Follow-Up Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {followups.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No pending follow-ups.</p>
                ) : (
                  <div className="space-y-2">
                    {followups.map((fu: any) => (
                      <Card key={fu.id}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{fu.brandaro_qualified_leads?.business_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">
                                Step {fu.sequence_step} · {fu.channel?.toUpperCase()} · {fu.trigger_event}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{fu.message_content}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={async () => {
                                await (supabase as any).from("brandaro_followup_sequences")
                                  .update({ status: "sent", sent_at: new Date().toISOString() })
                                  .eq("id", fu.id);
                                toast.success("Follow-up sent");
                                queryClient.invalidateQueries({ queryKey: ["brandaro-pending-followups"] });
                              }}>
                                <Send className="h-3 w-3 mr-1" /> Send
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PIPELINE TAB ──────────────────────── */}
        <TabsContent value="pipeline">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Close Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {pipeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Pipeline empty — start closing deals!</p>
                ) : (
                  <div className="space-y-2">
                    {pipeline.map((deal: any) => (
                      <Card key={deal.id} className={`border-l-4 ${
                        deal.stage === "closed" ? "border-l-green-500" :
                        deal.stage === "negotiating" ? "border-l-yellow-500" :
                        deal.stage === "interested" ? "border-l-blue-500" :
                        "border-l-muted"
                      }`}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{deal.brandaro_qualified_leads?.business_name || "Unknown"}</p>
                              <div className="flex gap-1 mt-1">
                                <Badge variant="outline" className="text-[10px] capitalize">{deal.stage.replace("_", " ")}</Badge>
                                {deal.package_tier && <Badge className="text-[10px]">{deal.package_tier}</Badge>}
                                {deal.payment_amount && <Badge variant="secondary" className="text-[10px]">${deal.payment_amount}</Badge>}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {deal.days_in_pipeline}d in pipeline · Priority: {deal.priority_score}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={async () => {
                                const stages = ["demo_sent", "demo_viewed", "interested", "negotiating", "closed"];
                                const currentIdx = stages.indexOf(deal.stage);
                                if (currentIdx < stages.length - 1) {
                                  const nextStage = stages[currentIdx + 1];
                                  await (supabase as any).from("brandaro_close_pipeline")
                                    .update({
                                      stage: nextStage,
                                      [`${nextStage}_at`]: new Date().toISOString(),
                                      updated_at: new Date().toISOString(),
                                    })
                                    .eq("id", deal.id);
                                  toast.success(`Moved to ${nextStage.replace("_", " ")}`);
                                  queryClient.invalidateQueries({ queryKey: ["brandaro-close-pipeline"] });
                                }
                              }}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Advance
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
