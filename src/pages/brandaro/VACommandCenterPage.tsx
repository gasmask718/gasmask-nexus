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
  Flame, Phone, Eye, FileText, Play,
  MessageSquare, Brain, Target, TrendingUp,
  AlertTriangle, Send, Clock,
  CheckCircle2, Star, Zap, Inbox, ShieldCheck,
  DollarSign, Reply
} from "lucide-react";

export default function VACommandCenterPage() {
  const queryClient = useQueryClient();
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [vaNote, setVaNote] = useState("");
  const [overrideOutcome, setOverrideOutcome] = useState("");
  const [activeTab, setActiveTab] = useState("hot-leads");

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
        .in("status", ["pending", "sent"])
        .order("scheduled_at", { ascending: true })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  // ─── INBOUND REPLIES ─────────────────────────────────
  const { data: inboundMessages = [] } = useQuery({
    queryKey: ["brandaro-inbound-messages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_inbound_messages")
        .select("*, brandaro_qualified_leads:lead_id(*)")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // ─── DEMO QUALITY SCORES ─────────────────────────────
  const { data: flaggedDemos = [] } = useQuery({
    queryKey: ["brandaro-flagged-demos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_demo_quality_scores")
        .select("*, brandaro_qualified_leads:lead_id(*)")
        .eq("flagged", true)
        .is("reviewed_at", null)
        .order("created_at", { ascending: false })
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

  const resolveInbound = async (messageId: string) => {
    await (supabase as any).from("brandaro_inbound_messages")
      .update({ resolved: true })
      .eq("id", messageId);
    toast.success("Message resolved");
    queryClient.invalidateQueries({ queryKey: ["brandaro-inbound-messages"] });
  };

  const approveFlaggedDemo = async (scoreId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from("brandaro_demo_quality_scores")
      .update({ flagged: false, reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
      .eq("id", scoreId);
    toast.success("Demo approved for send");
    queryClient.invalidateQueries({ queryKey: ["brandaro-flagged-demos"] });
  };

  const advancePipelineStage = async (dealId: string, newStage: string) => {
    const updates: any = { stage: newStage };
    if (newStage === "demo_viewed") updates.demo_viewed_at = new Date().toISOString();
    if (newStage === "interested") updates.interested_at = new Date().toISOString();
    if (newStage === "closed") updates.closed_at = new Date().toISOString();

    await (supabase as any).from("brandaro_close_pipeline").update(updates).eq("id", dealId);
    toast.success(`Stage → ${newStage.replace("_", " ")}`);
    queryClient.invalidateQueries({ queryKey: ["brandaro-close-pipeline"] });
  };

  const sendPaymentLink = async (deal: any) => {
    try {
      toast.loading("Generating payment link...");
      const { data, error } = await supabase.functions.invoke("brandaro-create-payment-link", {
        body: {
          deal_id: deal.id,
          lead_id: deal.lead_id,
          package_tier: deal.package_tier || "starter",
          send_sms: true,
        },
      });
      toast.dismiss();
      if (error) throw error;
      if (data?.checkout_url) {
        toast.success(`Payment link sent! ${data.reused ? "(reused existing)" : ""}`);
        queryClient.invalidateQueries({ queryKey: ["brandaro-close-pipeline"] });
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Payment link failed: ${err.message}`);
    }
  };

  const stageCounts = {
    demo_sent: pipeline.filter((p: any) => p.stage === "demo_sent").length,
    demo_viewed: pipeline.filter((p: any) => p.stage === "demo_viewed").length,
    interested: pipeline.filter((p: any) => p.stage === "interested").length,
    negotiating: pipeline.filter((p: any) => p.stage === "negotiating").length,
    closed: pipeline.filter((p: any) => p.stage === "closed").length,
  };

  const unresolvedInbound = inboundMessages.filter((m: any) => m.requires_va);

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
            <Reply className="h-3 w-3 text-green-500" /> {unresolvedInbound.length} Replies
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3 text-red-500" /> {flaggedDemos.length} Flagged
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3 text-yellow-500" /> {followups.filter((f: any) => f.status === "pending").length} Pending
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="hot-leads" className="gap-1 text-xs">
            <Flame className="h-3 w-3" /> Hot
          </TabsTrigger>
          <TabsTrigger value="inbound" className="gap-1 text-xs">
            <Inbox className="h-3 w-3" /> Replies
            {unresolvedInbound.length > 0 && (
              <span className="ml-1 bg-red-500 text-white rounded-full px-1 text-[10px]">{unresolvedInbound.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="demo-quality" className="gap-1 text-xs">
            <ShieldCheck className="h-3 w-3" /> QC
          </TabsTrigger>
          <TabsTrigger value="call-review" className="gap-1 text-xs">
            <FileText className="h-3 w-3" /> Calls
          </TabsTrigger>
          <TabsTrigger value="follow-ups" className="gap-1 text-xs">
            <Send className="h-3 w-3" /> Follow-Ups
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1 text-xs">
            <Target className="h-3 w-3" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1 text-xs">
            <DollarSign className="h-3 w-3" /> Close
          </TabsTrigger>
        </TabsList>

        {/* ─── HOT LEADS TAB ──────────────────────── */}
        <TabsContent value="hot-leads">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Hot Leads — Score 80+ (90+ = Immediate Action)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {hotLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No hot leads right now.</p>
                ) : (
                  <div className="space-y-2">
                    {hotLeads.map((lead: any) => (
                      <Card key={lead.id} className={`border-l-4 ${(lead.handoff_score || 0) >= 90 ? "border-l-red-500 bg-red-500/5" : "border-l-orange-500"}`}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{lead.brandaro_qualified_leads?.business_name || "Unknown"}</p>
                                {(lead.handoff_score || 0) >= 90 && (
                                  <Badge className="bg-red-500 text-[10px]">🔥 PRIORITY</Badge>
                                )}
                              </div>
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
                                <Phone className="h-3 w-3 mr-1" /> Review
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

        {/* ─── INBOUND REPLIES TAB ────────────────── */}
        <TabsContent value="inbound">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Inbox className="h-4 w-4 text-green-500" />
                Inbound Replies — {unresolvedInbound.length} Need VA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {inboundMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No unresolved replies.</p>
                ) : (
                  <div className="space-y-2">
                    {inboundMessages.map((msg: any) => (
                      <Card key={msg.id} className={`border-l-4 ${msg.requires_va ? "border-l-red-500" : "border-l-green-500"}`}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">
                                  {msg.brandaro_qualified_leads?.business_name || msg.sender_phone || "Unknown"}
                                </p>
                                <Badge variant={msg.requires_va ? "destructive" : "secondary"} className="text-[10px]">
                                  {msg.intent_detected}
                                </Badge>
                                {msg.ai_auto_responded && (
                                  <Badge variant="outline" className="text-[10px]">AI Replied</Badge>
                                )}
                              </div>
                              <p className="text-xs mt-1 bg-muted/50 rounded p-2">"{msg.message}"</p>
                              {msg.ai_response && (
                                <p className="text-xs mt-1 text-muted-foreground">
                                  AI: "{msg.ai_response}"
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 ml-2">
                              {msg.requires_va && msg.lead_id && (
                                <Button size="sm" variant="outline" onClick={() => triggerFollowup(msg.lead_id, "sms")}>
                                  <Send className="h-3 w-3" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => resolveInbound(msg.id)}>
                                <CheckCircle2 className="h-3 w-3" />
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

        {/* ─── DEMO QUALITY CONTROL TAB ───────────── */}
        <TabsContent value="demo-quality">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-red-500" />
                Demo Quality Control — {flaggedDemos.length} Flagged
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {flaggedDemos.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">All demos passed quality check ✅</p>
                ) : (
                  <div className="space-y-2">
                    {flaggedDemos.map((demo: any) => (
                      <Card key={demo.id} className="border-l-4 border-l-red-500">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">
                                {demo.brandaro_qualified_leads?.business_name || "Unknown Lead"}
                              </p>
                              <div className="flex gap-3 mt-1">
                                <div className="text-center">
                                  <div className="text-sm font-bold">{demo.design_score}</div>
                                  <div className="text-[10px] text-muted-foreground">Design</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm font-bold">{demo.uniqueness_score}</div>
                                  <div className="text-[10px] text-muted-foreground">Unique</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm font-bold">{demo.conversion_score}</div>
                                  <div className="text-[10px] text-muted-foreground">Convert</div>
                                </div>
                                <div className="text-center">
                                  <div className={`text-sm font-bold ${demo.overall_score < 70 ? "text-red-500" : "text-green-500"}`}>
                                    {demo.overall_score}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">Overall</div>
                                </div>
                              </div>
                              <div className="flex gap-1 mt-1">
                                {demo.cta_present ? (
                                  <Badge variant="outline" className="text-[10px]">CTA ✓</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px]">No CTA</Badge>
                                )}
                                {demo.mobile_friendly ? (
                                  <Badge variant="outline" className="text-[10px]">Mobile ✓</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px]">Not Mobile</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="text-green-600" onClick={() => approveFlaggedDemo(demo.id)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
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
                          {call.ai_confidence_score != null && <span>Conf: {call.ai_confidence_score}%</span>}
                          {call.conversion_probability != null && <span>Conv: {call.conversion_probability}%</span>}
                          <span>HS: {call.handoff_score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

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

                      {selectedCall.call_transcript && (
                        <div>
                          <p className="text-xs font-medium mb-1">Transcript</p>
                          <div className="bg-muted/50 rounded p-2 text-xs max-h-32 overflow-y-auto">
                            {selectedCall.call_transcript}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-medium mb-1">Override Outcome</p>
                        <Select value={overrideOutcome} onValueChange={setOverrideOutcome}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select outcome..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="demo_requested">Demo Requested</SelectItem>
                            <SelectItem value="contact_captured">Contact Captured</SelectItem>
                            <SelectItem value="interested">Interested</SelectItem>
                            <SelectItem value="not_interested">Not Interested</SelectItem>
                            <SelectItem value="callback">Callback</SelectItem>
                            <SelectItem value="wrong_number">Wrong Number</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea
                          className="mt-2 text-xs h-16"
                          placeholder="VA notes..."
                          value={vaNote}
                          onChange={(e) => setVaNote(e.target.value)}
                        />
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => handleOverrideOutcome(selectedCall)} disabled={!overrideOutcome}>
                            <Star className="h-3 w-3 mr-1" /> Override
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => triggerFollowup(selectedCall.lead_id, "sms")}>
                            <Send className="h-3 w-3 mr-1" /> SMS
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
                <Send className="h-4 w-4 text-blue-500" />
                Follow-Up Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {followups.map((fu: any) => (
                    <Card key={fu.id}>
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{fu.brandaro_qualified_leads?.business_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">
                              Step {fu.sequence_step} · {fu.channel} · {fu.trigger_event}
                            </p>
                            <p className="text-xs mt-1 text-muted-foreground truncate max-w-[300px]">
                              "{fu.message_content}"
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={fu.status === "sent" ? "default" : fu.status === "failed" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {fu.sent ? "✓ Sent" : fu.status}
                            </Badge>
                            {fu.reply_received && (
                              <Badge className="bg-green-500 text-[10px]">Replied!</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PIPELINE TAB ──────────────────────── */}
        <TabsContent value="pipeline">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-500" />
                Close Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {pipeline.map((deal: any) => {
                    const stageColors: Record<string, string> = {
                      demo_sent: "border-l-blue-500",
                      demo_viewed: "border-l-cyan-500",
                      interested: "border-l-green-500",
                      negotiating: "border-l-orange-500",
                      closed: "border-l-emerald-500",
                    };
                    const nextStages: Record<string, string[]> = {
                      demo_sent: ["demo_viewed", "interested"],
                      demo_viewed: ["interested", "negotiating"],
                      interested: ["negotiating", "closed"],
                      negotiating: ["closed"],
                    };

                    return (
                      <Card key={deal.id} className={`border-l-4 ${stageColors[deal.stage] || ""}`}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{deal.brandaro_qualified_leads?.business_name || "Unknown"}</p>
                              <div className="flex gap-2 items-center mt-1">
                                <Badge variant="outline" className="text-[10px]">{deal.stage?.replace("_", " ")}</Badge>
                                {deal.urgency_level === "critical" && (
                                  <Badge className="bg-red-500 text-[10px]">URGENT</Badge>
                                )}
                                {deal.urgency_level === "high" && (
                                  <Badge className="bg-orange-500 text-[10px]">HIGH</Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground">Priority: {deal.priority_score}</span>
                              </div>
                              {deal.nudge_count > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Nudged {deal.nudge_count}x · Last: {deal.last_nudge_at ? new Date(deal.last_nudge_at).toLocaleDateString() : "—"}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {(nextStages[deal.stage] || []).map((ns: string) => (
                                <Button key={ns} size="sm" variant="outline" className="text-[10px] h-7" onClick={() => advancePipelineStage(deal.id, ns)}>
                                  → {ns.replace("_", " ")}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── CLOSE / PAYMENTS TAB ──────────────── */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                Close Acceleration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {pipeline
                    .filter((d: any) => ["negotiating", "interested", "demo_viewed"].includes(d.stage))
                    .map((deal: any) => (
                      <Card key={deal.id} className="border-l-4 border-l-green-500">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{deal.brandaro_qualified_leads?.business_name || "Unknown"}</p>
                              <Badge variant="outline" className="text-[10px] mt-1">{deal.stage?.replace("_", " ")}</Badge>
                              <div className="flex gap-2 mt-2">
                                {deal.payment_link_sent_at && (
                                  <Badge className="text-[10px]">💳 Link Sent</Badge>
                                )}
                                {deal.payment_link_clicked && (
                                  <Badge className="bg-green-500 text-[10px]">👀 Link Clicked!</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button size="sm" onClick={() => triggerFollowup(deal.lead_id, "sms")}>
                                <Zap className="h-3 w-3 mr-1" /> Push Close
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => advancePipelineStage(deal.id, "closed")}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Closed
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
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
