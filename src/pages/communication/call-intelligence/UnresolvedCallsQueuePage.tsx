import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";
import {
  Phone,
  PhoneMissed,
  Voicemail,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  User,
  MessageSquare,
  Timer,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useBusinessStore } from "@/stores/businessStore";
import { Link } from "react-router-dom";

interface UnresolvedItem {
  id: string;
  type: "missed_call" | "voicemail";
  caller_number: string;
  caller_name?: string;
  business_id: string;
  created_at: string;
  sla_deadline?: string;
  escalation_level: number;
  priority: string;
  status: string;
  outcome_reason?: string;
  ai_intent?: string;
  ai_summary?: string;
  ai_suggested_action?: string;
}

export default function UnresolvedCallsQueuePage() {
  const { selectedBusiness } = useBusinessStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "critical" | "sla_breach">("all");

  // Fetch unresolved missed calls
  const { data: missedCalls, isLoading: missedLoading, refetch: refetchMissed } = useQuery({
    queryKey: ["unresolved-calls", selectedBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_outcomes")
        .select("*")
        .eq("business_id", selectedBusiness?.id)
        .in("outcome", ["missed", "voicemail"])
        .neq("resolution_status", "resolved")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        type: c.outcome === "voicemail" ? "voicemail" : "missed_call",
        caller_number: c.caller_number as string,
        business_id: c.business_id as string,
        created_at: c.created_at as string,
        escalation_level: 0,
        priority: "normal",
        status: c.resolution_status as string,
        outcome_reason: c.outcome_reason as string,
      })) as UnresolvedItem[];
    },
    enabled: !!selectedBusiness?.id,
  });

  // Fetch unresolved voicemails with AI analysis
  const { data: voicemails, isLoading: voicemailsLoading, refetch: refetchVoicemails } = useQuery({
    queryKey: ["unresolved-voicemails", selectedBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voicemails")
        .select("*")
        .eq("business_id", selectedBusiness?.id)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map((v: Record<string, unknown>) => ({
        id: v.id as string,
        type: "voicemail" as const,
        caller_number: v.caller_number as string,
        caller_name: v.caller_name as string | undefined,
        business_id: v.business_id as string,
        created_at: v.created_at as string,
        escalation_level: 0,
        priority: v.ai_priority_score && (v.ai_priority_score as number) >= 7 ? "high" : "normal",
        status: v.status as string,
        ai_intent: v.ai_intent as string | undefined,
        ai_summary: v.ai_summary as string | undefined,
        ai_suggested_action: v.ai_suggested_action as string | undefined,
      })) as UnresolvedItem[];
    },
    enabled: !!selectedBusiness?.id,
  });

  // Fetch pending follow-ups with SLA info
  const { data: followups, isLoading: followupsLoading } = useQuery({
    queryKey: ["pending-followups", selectedBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_followups")
        .select("*")
        .eq("business_id", selectedBusiness?.id)
        .eq("status", "pending")
        .order("sla_deadline", { ascending: true })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBusiness?.id,
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ id, type, resolution }: { id: string; type: string; resolution: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (type === "voicemail") {
        await supabase.from("voicemails").update({ 
          status: "resolved",
          resolved_by: user?.id,
        }).eq("id", id);
      } else {
        await supabase.from("call_outcomes").update({ 
          resolution_status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        }).eq("id", id);
      }

      // Also complete any related follow-ups
      await supabase.from("call_followups")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          resolution_type: resolution,
        })
        .or(`voicemail_id.eq.${id},call_outcome_id.eq.${id}`);
    },
    onSuccess: () => {
      toast.success("Marked as resolved");
      queryClient.invalidateQueries({ queryKey: ["unresolved-calls"] });
      queryClient.invalidateQueries({ queryKey: ["unresolved-voicemails"] });
      queryClient.invalidateQueries({ queryKey: ["pending-followups"] });
    },
  });

  // Escalate mutation
  const escalateMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      if (type === "voicemail") {
        await supabase.from("voicemails").update({ status: "escalated" }).eq("id", id);
      } else {
        await supabase.from("call_outcomes").update({ resolution_status: "escalated" }).eq("id", id);
      }

      await supabase.from("communication_escalations").insert({
        business_id: selectedBusiness?.id,
        escalation_type: type === "voicemail" ? "voicemail_unresolved" : "missed_call",
        severity: "high",
        ai_notes: "Manually escalated from unresolved queue",
      });
    },
    onSuccess: () => {
      toast.success("Escalated to management");
      refetchMissed();
      refetchVoicemails();
    },
  });

  // AI analyze mutation
  const analyzeVoicemailMutation = useMutation({
    mutationFn: async (voicemailId: string) => {
      const { data, error } = await supabase.functions.invoke("call-ai-assist", {
        body: { action: "summarize_voicemail", voicemail_id: voicemailId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`AI Analysis: ${data.intent || "Complete"}`);
      refetchVoicemails();
    },
    onError: () => {
      toast.error("AI analysis failed");
    },
  });

  // Combine all items
  const allItems = [
    ...(missedCalls || []),
    ...(voicemails || []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const criticalItems = allItems.filter(i => i.priority === "high" || i.priority === "critical" || i.escalation_level > 0);
  const slaBreaches = followups?.filter((f: { sla_deadline?: string }) => 
    f.sla_deadline && new Date(f.sla_deadline) < new Date()
  ) || [];

  const getSLAStatus = (deadline?: string) => {
    if (!deadline) return null;
    const mins = differenceInMinutes(new Date(deadline), new Date());
    if (mins < 0) return { status: "breached", color: "text-destructive", label: `${Math.abs(mins)}m overdue` };
    if (mins < 15) return { status: "critical", color: "text-amber-500", label: `${mins}m left` };
    if (mins < 60) return { status: "warning", color: "text-yellow-500", label: `${mins}m left` };
    return { status: "ok", color: "text-green-500", label: formatDistanceToNow(new Date(deadline)) };
  };

  const getIntentBadge = (intent?: string) => {
    const colors: Record<string, string> = {
      sales: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      support: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      complaint: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      urgent: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      inquiry: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      general: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    };
    return colors[intent || "general"] || colors.general;
  };

  const isLoading = missedLoading || voicemailsLoading || followupsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unresolved Calls Queue</h1>
          <p className="text-muted-foreground">All calls requiring action with SLA tracking</p>
        </div>
        <Button variant="outline" onClick={() => { refetchMissed(); refetchVoicemails(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{allItems.length}</p>
                <p className="text-sm text-muted-foreground">Total Unresolved</p>
              </div>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Phone className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{criticalItems.length}</p>
                <p className="text-sm text-muted-foreground">Critical / High</p>
              </div>
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{slaBreaches.length}</p>
                <p className="text-sm text-muted-foreground">SLA Breached</p>
              </div>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Timer className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{voicemails?.filter(v => v.ai_summary).length || 0}</p>
                <p className="text-sm text-muted-foreground">AI Analyzed</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="all">All ({allItems.length})</TabsTrigger>
          <TabsTrigger value="critical">
            Critical ({criticalItems.length})
            {criticalItems.length > 0 && <span className="ml-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="sla_breach">
            SLA Breach ({slaBreaches.length})
            {slaBreaches.length > 0 && <span className="ml-1 w-2 h-2 bg-destructive rounded-full animate-pulse" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Queue</CardTitle>
              <CardDescription>Missed calls and voicemails awaiting resolution</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : allItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="font-medium">Queue is empty!</p>
                    <p className="text-sm">All calls have been resolved</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allItems.map((item) => (
                      <QueueItem
                        key={item.id}
                        item={item}
                        onResolve={(resolution) => resolveMutation.mutate({ id: item.id, type: item.type, resolution })}
                        onEscalate={() => escalateMutation.mutate({ id: item.id, type: item.type })}
                        onAnalyze={() => analyzeVoicemailMutation.mutate(item.id)}
                        getIntentBadge={getIntentBadge}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="critical" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Critical Items</CardTitle>
              <CardDescription>High priority and escalated items requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {criticalItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No critical items</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {criticalItems.map((item) => (
                      <QueueItem
                        key={item.id}
                        item={item}
                        onResolve={(resolution) => resolveMutation.mutate({ id: item.id, type: item.type, resolution })}
                        onEscalate={() => escalateMutation.mutate({ id: item.id, type: item.type })}
                        onAnalyze={() => analyzeVoicemailMutation.mutate(item.id)}
                        getIntentBadge={getIntentBadge}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla_breach" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">SLA Breaches</CardTitle>
              <CardDescription>Follow-ups that have exceeded their deadline</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {slaBreaches.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No SLA breaches</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {slaBreaches.map((followup: {
                      id: string;
                      title: string;
                      caller_number: string;
                      sla_deadline: string;
                      priority: string;
                      created_at: string;
                    }) => {
                      const sla = getSLAStatus(followup.sla_deadline);
                      return (
                        <div key={followup.id} className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-destructive/10 rounded-lg">
                                <Timer className="h-5 w-5 text-destructive" />
                              </div>
                              <div>
                                <p className="font-medium">{followup.title}</p>
                                <p className="text-sm text-muted-foreground">{followup.caller_number}</p>
                                {sla && (
                                  <p className={`text-sm font-medium mt-1 ${sla.color}`}>
                                    ⏱️ {sla.label}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <Phone className="h-3 w-3 mr-1" />
                                Call Back
                              </Button>
                              <Button size="sm" variant="destructive">
                                <ArrowUp className="h-3 w-3 mr-1" />
                                Escalate
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

// Queue Item Component
function QueueItem({
  item,
  onResolve,
  onEscalate,
  onAnalyze,
  getIntentBadge,
}: {
  item: UnresolvedItem;
  onResolve: (resolution: string) => void;
  onEscalate: () => void;
  onAnalyze: () => void;
  getIntentBadge: (intent?: string) => string;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div 
      className={`p-4 rounded-lg border transition-colors ${
        item.priority === "high" || item.priority === "critical"
          ? "border-amber-500/50 bg-amber-500/5"
          : "hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${
            item.type === "voicemail" 
              ? "bg-purple-100 dark:bg-purple-900/20" 
              : "bg-red-100 dark:bg-red-900/20"
          }`}>
            {item.type === "voicemail" ? (
              <Voicemail className="h-5 w-5 text-purple-600" />
            ) : (
              <PhoneMissed className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {item.caller_name || item.caller_number}
              </span>
              {item.ai_intent && (
                <Badge className={getIntentBadge(item.ai_intent)} variant="outline">
                  {item.ai_intent}
                </Badge>
              )}
              {item.priority === "high" && (
                <Badge variant="destructive">High Priority</Badge>
              )}
            </div>
            {item.caller_name && (
              <p className="text-sm text-muted-foreground">{item.caller_number}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              <Clock className="inline h-3 w-3 mr-1" />
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              {item.outcome_reason && ` • ${item.outcome_reason.replace(/_/g, " ")}`}
            </p>
            {item.ai_summary && (
              <p className="text-sm mt-2 p-2 bg-muted rounded">
                💬 {item.ai_summary}
              </p>
            )}
            {item.ai_suggested_action && (
              <p className="text-sm text-primary mt-1">
                → {item.ai_suggested_action}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.type === "voicemail" && !item.ai_summary && (
            <Button size="sm" variant="ghost" onClick={onAnalyze}>
              🤖 Analyze
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setShowActions(!showActions)}>
            Actions
          </Button>
        </div>
      </div>

      {showActions && (
        <div className="mt-3 pt-3 border-t flex items-center gap-2">
          <Select onValueChange={onResolve}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Resolve as..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="callback_made">Called Back</SelectItem>
              <SelectItem value="sms_sent">SMS Sent</SelectItem>
              <SelectItem value="resolved_other">Resolved (Other)</SelectItem>
              <SelectItem value="no_action_needed">No Action Needed</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={onEscalate}>
            <ArrowUp className="h-3 w-3 mr-1" />
            Escalate
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/communication-hub/call-intelligence/voicemail?id=${item.id}`}>
              <ExternalLink className="h-3 w-3 mr-1" />
              View Details
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
