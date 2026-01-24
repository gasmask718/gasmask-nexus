import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CommunicationHubLayout } from "../CommunicationHubLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  Brain,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Clock,
  Users,
  Phone,
  PhoneMissed,
  Voicemail,
  Lightbulb,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useCurrentBusiness } from "@/hooks/useCurrentBusiness";
import { Link } from "react-router-dom";

interface IntelligenceSignal {
  id: string;
  business_id: string | null;
  signal_type: string;
  severity: string;
  title: string;
  description: string | null;
  metric_value: number | null;
  metric_unit: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  suggested_action: string | null;
  is_resolved: boolean;
  created_at: string;
}

export default function CallIntelligencePage() {
  const { currentBusiness } = useCurrentBusiness();

  // Fetch intelligence signals
  const { data: signals, isLoading, refetch } = useQuery({
    queryKey: ["call-intelligence-signals", currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_intelligence_signals")
        .select("*")
        .eq("business_id", currentBusiness?.id)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as IntelligenceSignal[];
    },
    enabled: !!currentBusiness?.id,
  });

  // Fetch call stats for overview
  const { data: callStats } = useQuery({
    queryKey: ["call-stats", currentBusiness?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: outcomes } = await supabase
        .from("call_outcomes")
        .select("outcome, is_business_hours")
        .eq("business_id", currentBusiness?.id)
        .gte("created_at", since);

      const { data: voicemails } = await supabase
        .from("voicemails")
        .select("id, status")
        .eq("business_id", currentBusiness?.id)
        .gte("created_at", since);

      const total = outcomes?.length || 0;
      const connected = outcomes?.filter(o => o.outcome === "connected").length || 0;
      const missed = outcomes?.filter(o => o.outcome === "missed").length || 0;
      const voicemailCount = outcomes?.filter(o => o.outcome === "voicemail").length || 0;
      const unresolvedVoicemails = voicemails?.filter(v => v.status !== "resolved").length || 0;
      const afterHoursMissed = outcomes?.filter(o => o.outcome === "missed" && !o.is_business_hours).length || 0;

      return {
        total,
        connected,
        missed,
        voicemailCount,
        unresolvedVoicemails,
        afterHoursMissed,
        answerRate: total > 0 ? (connected / total) * 100 : 0,
        missRate: total > 0 ? (missed / total) * 100 : 0,
      };
    },
    enabled: !!currentBusiness?.id,
  });

  // Trigger intelligence analysis
  const runAnalysis = async () => {
    try {
      toast.loading("Analyzing call patterns...");
      const { data, error } = await supabase.functions.invoke("call-outcome-intelligence", {
        body: { action: "analyze_business", business_id: currentBusiness?.id },
      });
      
      if (error) throw error;
      
      toast.dismiss();
      toast.success(`Generated ${data.signals?.length || 0} new insights`);
      refetch();
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to analyze call patterns");
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-destructive/10 border-destructive/30 text-destructive";
      case "warning":
        return "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400";
      default:
        return "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400";
    }
  };

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case "high_miss_rate":
        return <TrendingDown className="h-4 w-4" />;
      case "after_hours_issues":
        return <Clock className="h-4 w-4" />;
      case "no_callable_role_users":
      case "uncallable_route_target":
        return <Users className="h-4 w-4" />;
      case "repeat_voicemail_callers":
        return <Voicemail className="h-4 w-4" />;
      case "low_business_hours_answer_rate":
        return <PhoneMissed className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getActionLink = (signalType: string) => {
    switch (signalType) {
      case "no_callable_role_users":
      case "uncallable_route_target":
        return "/communication-hub/call-settings/user-settings";
      case "after_hours_issues":
        return "/communication-hub/call-settings/after-hours";
      case "repeat_voicemail_callers":
        return "/communication-hub/call-intelligence/voicemail";
      default:
        return "/communication-hub/call-settings/diagnostics";
    }
  };

  const criticalCount = signals?.filter(s => s.severity === "critical").length || 0;
  const warningCount = signals?.filter(s => s.severity === "warning").length || 0;

  return (
    <CommunicationHubLayout title="Call Intelligence" subtitle="AI-powered insights into your call performance">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Intelligence Engine</h2>
            <p className="text-sm text-muted-foreground">
              {signals?.length || 0} active insight{(signals?.length || 0) !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={runAnalysis}>
          <Zap className="h-4 w-4 mr-2" />
          Run Analysis
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {callStats?.answerRate.toFixed(1) || 0}%
                </p>
                <p className="text-sm text-muted-foreground">Answer Rate (7d)</p>
              </div>
              <div className={`p-2 rounded-lg ${(callStats?.answerRate || 0) > 70 ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"}`}>
                {(callStats?.answerRate || 0) > 70 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{callStats?.missed || 0}</p>
                <p className="text-sm text-muted-foreground">Missed Calls (7d)</p>
              </div>
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <PhoneMissed className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{callStats?.unresolvedVoicemails || 0}</p>
                <p className="text-sm text-muted-foreground">Pending Voicemails</p>
              </div>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Voicemail className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{criticalCount}</p>
                <p className="text-sm text-muted-foreground">Critical Issues</p>
              </div>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intelligence Signals */}
      <div className="grid grid-cols-2 gap-6">
        {/* Critical & Warning Signals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Action Required
            </CardTitle>
            <CardDescription>
              {criticalCount + warningCount} issue{criticalCount + warningCount !== 1 ? "s" : ""} need attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading insights...</div>
              ) : !signals?.filter(s => s.severity !== "info").length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="font-medium">All clear!</p>
                  <p className="text-sm">No critical issues detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {signals
                    .filter(s => s.severity !== "info")
                    .map((signal) => (
                      <div
                        key={signal.id}
                        className={`p-4 rounded-lg border ${getSeverityColor(signal.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(signal.severity)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {getSignalIcon(signal.signal_type)}
                              <span className="font-medium">{signal.title}</span>
                            </div>
                            {signal.description && (
                              <p className="text-sm opacity-80 mt-1">{signal.description}</p>
                            )}
                            {signal.suggested_action && (
                              <div className="flex items-center gap-2 mt-3">
                                <Button asChild variant="secondary" size="sm">
                                  <Link to={getActionLink(signal.signal_type)}>
                                    Fix Now
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                  </Link>
                                </Button>
                                <span className="text-xs opacity-70">{signal.suggested_action}</span>
                              </div>
                            )}
                          </div>
                          {signal.metric_value !== null && (
                            <Badge variant="outline">
                              {signal.metric_value.toFixed(1)}{signal.metric_unit === "percent" ? "%" : ` ${signal.metric_unit}`}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions & Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Recommendations
            </CardTitle>
            <CardDescription>
              AI-generated suggestions to improve call handling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Dynamic recommendations based on stats */}
              {(callStats?.missRate || 0) > 20 && (
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Add More Callable Users</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your miss rate is {callStats?.missRate.toFixed(1)}%. Consider adding more team members to handle inbound calls.
                      </p>
                      <Button asChild variant="link" className="px-0 mt-2 h-auto">
                        <Link to="/communication-hub/call-settings/user-settings">
                          Configure Users
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {(callStats?.afterHoursMissed || 0) > 3 && (
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Improve After-Hours Handling</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {callStats?.afterHoursMissed} calls were missed after hours. Set up voicemail or on-call routing.
                      </p>
                      <Button asChild variant="link" className="px-0 mt-2 h-auto">
                        <Link to="/communication-hub/call-settings/after-hours">
                          Configure After-Hours
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {(callStats?.unresolvedVoicemails || 0) > 0 && (
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Voicemail className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Review Pending Voicemails</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        You have {callStats?.unresolvedVoicemails} unresolved voicemails waiting for callbacks.
                      </p>
                      <Button asChild variant="link" className="px-0 mt-2 h-auto">
                        <Link to="/communication-hub/call-intelligence/voicemail">
                          Open Voicemail Inbox
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Always show diagnostics recommendation */}
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Run a Test Ring</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verify your routing configuration is working correctly before real calls come in.
                    </p>
                    <Button asChild variant="link" className="px-0 mt-2 h-auto">
                      <Link to="/communication-hub/call-settings/diagnostics">
                        Open Diagnostics
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </CommunicationHubLayout>
  );
}
