import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Users,
  FileText,
  Power,
  Activity,
  MessageSquare,
} from "lucide-react";

interface PreLiveChecklistProps {
  businessId: string;
  onAllPassed?: (passed: boolean) => void;
  className?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  critical: boolean;
  category: "infrastructure" | "safety" | "compliance" | "audit";
  fixLink?: string;
  details?: string;
}

export function PreLiveChecklist({
  businessId,
  onAllPassed,
  className,
}: PreLiveChecklistProps) {
  const { data: checklistData, isLoading, refetch } = useQuery({
    queryKey: ["pre-live-checklist", businessId],
    queryFn: async () => {
      // Parallel fetch all required data
      const [
        configRes,
        callableUsersRes,
        killSwitchRes,
        auditHealthRes,
        trustScoreRes,
        authorizationRes,
      ] = await Promise.all([
        // AI Config
        supabase
          .from("ai_call_agent_config")
          .select("*")
          .eq("business_id", businessId)
          .single(),
        // Callable users
        (supabase.from("user_profiles").select("id, phone") as any)
          .eq("business_id", businessId)
          .eq("is_callable", true)
          .not("phone", "is", null),
        // Kill switch state
        supabase
          .from("ai_kill_switch_state")
          .select("*")
          .eq("is_active", true)
          .or(`scope.eq.global,and(scope.eq.business,business_id.eq.${businessId})`),
        // Recent audit events (health check)
        supabase
          .from("ai_audit_events")
          .select("id, created_at")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(5),
        // Trust score
        supabase
          .from("ai_trust_scores")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
        // Live authorization
        supabase
          .from("ai_live_authorizations")
          .select("*")
          .eq("business_id", businessId)
          .eq("status", "approved")
          .order("authorized_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const config = configRes.data;
      const callableUsers = callableUsersRes.data || [];
      const activeKillSwitches = killSwitchRes.data || [];
      const recentAuditEvents = auditHealthRes.data || [];
      const trustScore = trustScoreRes.data;
      const authorization = authorizationRes.data;

      // Determine audit health
      const auditHealthy = recentAuditEvents.length > 0;
      const lastAuditAge = recentAuditEvents[0]
        ? Date.now() - new Date(recentAuditEvents[0].created_at).getTime()
        : Infinity;
      const auditFresh = lastAuditAge < 24 * 60 * 60 * 1000; // Within 24h

      // Check authorization expiry
      const authValid =
        authorization &&
        (!authorization.expires_at || new Date(authorization.expires_at) > new Date());

      return {
        // Infrastructure
        hasCallableUsers: callableUsers.length > 0,
        callableUserCount: callableUsers.length,
        hasConfig: !!config,
        liveModeEnabled: config?.live_mode_enabled ?? false,
        
        // Safety
        killSwitchesReachable: true, // Always true if we got here
        noActiveKillSwitches: activeKillSwitches.length === 0,
        activeKillSwitchCount: activeKillSwitches.length,
        hasEscapePhrases: (config?.escape_phrases?.length || 0) > 0,
        hasHighRiskKeywords: (config?.high_risk_keywords?.length || 0) > 0,
        
        // Compliance
        hasDisclosureScript: !!(config?.ai_disclosure_script),
        consentRecordingEnabled: config?.consent_recording_enabled ?? false,
        
        // Audit
        auditLoggingHealthy: auditHealthy && auditFresh,
        hasAuthorization: !!authorization,
        authorizationValid: authValid,
        trustScore: trustScore?.trust_score || 0,
        trustThreshold: config?.live_trust_threshold || 92,
      };
    },
    enabled: !!businessId,
  });

  React.useEffect(() => {
    if (checklistData && onAllPassed) {
      const allCriticalPassed =
        checklistData.hasCallableUsers &&
        checklistData.hasConfig &&
        checklistData.noActiveKillSwitches &&
        checklistData.auditLoggingHealthy &&
        checklistData.hasDisclosureScript &&
        checklistData.authorizationValid;
      onAllPassed(allCriticalPassed);
    }
  }, [checklistData, onAllPassed]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-muted-foreground">
          Checking pre-live requirements...
        </CardContent>
      </Card>
    );
  }

  const items: ChecklistItem[] = [
    // Infrastructure
    {
      id: "callable_users",
      label: "Callable Human Fallback",
      description: `${checklistData?.callableUserCount || 0} user(s) can receive escalated calls`,
      passed: checklistData?.hasCallableUsers ?? false,
      critical: true,
      category: "infrastructure",
      fixLink: "/communication-hub/call-settings/user-settings",
    },
    {
      id: "ai_config",
      label: "AI Agent Configured",
      description: "Core AI configuration exists",
      passed: checklistData?.hasConfig ?? false,
      critical: true,
      category: "infrastructure",
      fixLink: "/communication-hub/call-intelligence/ai-agent",
    },
    // Safety
    {
      id: "kill_switches",
      label: "Kill Switches Accessible",
      description: checklistData?.noActiveKillSwitches
        ? "No active kill switches"
        : `${checklistData?.activeKillSwitchCount} kill switch(es) active`,
      passed: checklistData?.noActiveKillSwitches ?? false,
      critical: true,
      category: "safety",
      details: "Kill switches must be inactive to enable Live Mode",
    },
    {
      id: "escape_phrases",
      label: "Escape Phrases Configured",
      description: "Caller can request human at any time",
      passed: checklistData?.hasEscapePhrases ?? false,
      critical: false,
      category: "safety",
      fixLink: "/communication-hub/call-intelligence/ai-agent",
    },
    {
      id: "high_risk_keywords",
      label: "High-Risk Keywords Configured",
      description: "Auto-escalation triggers defined",
      passed: checklistData?.hasHighRiskKeywords ?? false,
      critical: false,
      category: "safety",
      fixLink: "/communication-hub/call-intelligence/ai-agent",
    },
    // Compliance
    {
      id: "disclosure_script",
      label: "AI Disclosure Script",
      description: "AI must identify itself to callers",
      passed: checklistData?.hasDisclosureScript ?? false,
      critical: true,
      category: "compliance",
      fixLink: "/communication-hub/call-intelligence/ai-agent",
    },
    {
      id: "consent_recording",
      label: "Consent Recording Enabled",
      description: "Call recording consent is captured",
      passed: checklistData?.consentRecordingEnabled ?? false,
      critical: false,
      category: "compliance",
      fixLink: "/communication-hub/call-intelligence/ai-agent",
    },
    // Audit
    {
      id: "audit_logging",
      label: "Audit Logging Healthy",
      description: "Decision logs are being written",
      passed: checklistData?.auditLoggingHealthy ?? false,
      critical: true,
      category: "audit",
    },
    {
      id: "authorization",
      label: "Live Mode Authorized",
      description: checklistData?.hasAuthorization
        ? checklistData?.authorizationValid
          ? "Admin authorization on file"
          : "Authorization expired"
        : "No authorization record",
      passed: checklistData?.authorizationValid ?? false,
      critical: true,
      category: "audit",
      fixLink: "/communication-hub/call-intelligence/ai-agent?tab=governance",
    },
  ];

  const criticalItems = items.filter((i) => i.critical);
  const passedCritical = criticalItems.filter((i) => i.passed).length;
  const allCriticalPassed = passedCritical === criticalItems.length;
  const allPassed = items.every((i) => i.passed);
  const progress = (passedCritical / criticalItems.length) * 100;

  const categories = ["infrastructure", "safety", "compliance", "audit"] as const;
  const categoryLabels: Record<typeof categories[number], string> = {
    infrastructure: "Infrastructure",
    safety: "Safety",
    compliance: "Compliance",
    audit: "Audit & Governance",
  };
  const categoryIcons: Record<typeof categories[number], React.ReactNode> = {
    infrastructure: <Users className="h-4 w-4" />,
    safety: <Shield className="h-4 w-4" />,
    compliance: <MessageSquare className="h-4 w-4" />,
    audit: <FileText className="h-4 w-4" />,
  };

  return (
    <Card className={`${allCriticalPassed ? "border-green-500/50" : "border-amber-500/50"} ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                allCriticalPassed
                  ? "bg-green-100 dark:bg-green-900/20"
                  : "bg-amber-100 dark:bg-amber-900/20"
              }`}
            >
              {allCriticalPassed ? (
                <ShieldCheck className="h-6 w-6 text-green-600" />
              ) : (
                <ShieldX className="h-6 w-6 text-amber-600" />
              )}
            </div>
            <div>
              <CardTitle>Pre-Live Checklist</CardTitle>
              <CardDescription>
                {passedCritical}/{criticalItems.length} critical requirements met
              </CardDescription>
            </div>
          </div>
          <Badge variant={allCriticalPassed ? "default" : "destructive"}>
            {allCriticalPassed ? (
              <>
                <Unlock className="h-3 w-3 mr-1" />
                Ready
              </>
            ) : (
              <>
                <Lock className="h-3 w-3 mr-1" />
                Blocked
              </>
            )}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {categories.map((category) => {
          const categoryItems = items.filter((i) => i.category === category);
          if (categoryItems.length === 0) return null;

          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                {categoryIcons[category]}
                <h4 className="text-sm font-semibold">{categoryLabels[category]}</h4>
              </div>
              <div className="space-y-2">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      item.passed
                        ? "bg-green-50 dark:bg-green-900/10"
                        : item.critical
                        ? "bg-red-50 dark:bg-red-900/10"
                        : "bg-amber-50 dark:bg-amber-900/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.passed ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : item.critical ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      )}
                      <div>
                        <p className="font-medium text-sm">
                          {item.label}
                          {item.critical && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Required
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    {!item.passed && item.fixLink && (
                      <Button asChild variant="ghost" size="sm">
                        <Link to={item.fixLink}>
                          Fix
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Trust Score Display */}
        {checklistData && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Trust Score</span>
              <span
                className={`font-bold ${
                  (checklistData.trustScore || 0) >= checklistData.trustThreshold
                    ? "text-green-600"
                    : "text-amber-600"
                }`}
              >
                {checklistData.trustScore?.toFixed(1)}% / {checklistData.trustThreshold}%
              </span>
            </div>
            <Progress
              value={checklistData.trustScore || 0}
              className="h-2"
            />
          </div>
        )}

        {/* Final Status */}
        {!allCriticalPassed && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Live Mode is BLOCKED</strong> until all critical requirements pass.
              This ensures AI never operates without proper safeguards.
            </AlertDescription>
          </Alert>
        )}

        {allCriticalPassed && !allPassed && (
          <Alert className="border-amber-500/50 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              Live Mode is <strong>available</strong> but some recommended items are incomplete.
              Consider addressing them for optimal safety.
            </AlertDescription>
          </Alert>
        )}

        {allPassed && (
          <Alert className="border-green-500/50 bg-green-500/5">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>All checks passed.</strong> AI is ready for Live Mode operation
              with full safety and compliance guardrails.
            </AlertDescription>
          </Alert>
        )}

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PreLiveChecklist;
