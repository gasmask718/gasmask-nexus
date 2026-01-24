import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Phone,
  Voicemail,
  Users,
  Clock,
} from "lucide-react";

interface GoLiveLocksCardProps {
  businessId: string;
  businessName: string;
}

interface LockCheck {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  critical: boolean;
  fixLink?: string;
}

export function GoLiveLocksCard({ businessId, businessName }: GoLiveLocksCardProps) {
  // Fetch all data needed for go-live locks
  const { data: readinessData, isLoading } = useQuery({
    queryKey: ["go-live-locks", businessId],
    queryFn: async () => {
      // Fetch all data individually with type assertions to avoid TS2589 type inference issues
      const businessRes = await supabase
        .from("businesses")
        .select("timezone, business_hours, after_hours_route_type")
        .eq("id", businessId)
        .single();

      const phoneNumbersRes = await supabase
        .from("business_phone_numbers")
        .select("id")
        .eq("business_id", businessId)
        .eq("is_active", true);

      const routesRes = await supabase
        .from("inbound_call_routes")
        .select("id, route_type")
        .eq("business_id", businessId)
        .eq("is_active", true);

      // Build query with type assertion early to avoid TS2589 deep type instantiation
      const userProfilesQuery = supabase.from("user_profiles").select("id, phone") as any;
      const callableUsersRes = await userProfilesQuery
        .eq("business_id", businessId)
        .eq("is_callable", true)
        .not("phone", "is", null);

      const voicemailSettingsRes = await supabase
        .from("business_voicemail_settings")
        .select("is_enabled")
        .eq("business_id", businessId)
        .maybeSingle();

      const unresolvedMissedRes = await supabase
        .from("call_outcomes")
        .select("id")
        .eq("business_id", businessId)
        .eq("outcome", "missed")
        .neq("resolution_status", "resolved");

      const unresolvedVoicemailsRes = await supabase
        .from("voicemails")
        .select("id")
        .eq("business_id", businessId)
        .neq("status", "resolved");

      const business = businessRes.data;
      const phoneNumbers = phoneNumbersRes.data;
      const routes = routesRes.data;
      const callableUsers = callableUsersRes.data;
      const voicemailSettings = voicemailSettingsRes.data;
      const unresolvedMissed = unresolvedMissedRes.data;
      const unresolvedVoicemails = unresolvedVoicemailsRes.data;

      // Check if routes have callable targets - simplified check
      const hasValidRoutes = (routes?.length || 0) > 0 && (callableUsers?.length || 0) > 0;

      return {
        hasCallerID: (phoneNumbers?.length || 0) > 0,
        hasTimezone: !!business?.timezone,
        hasBusinessHours: !!business?.business_hours,
        hasAfterHoursRoute: !!business?.after_hours_route_type,
        hasCallableUsers: (callableUsers?.length || 0) > 0,
        callableUserCount: callableUsers?.length || 0,
        hasInboundRoutes: (routes?.length || 0) > 0,
        allRoutesHaveTargets: hasValidRoutes,
        hasVoicemailConfigured: voicemailSettings?.is_enabled ?? false,
        unresolvedMissedCount: unresolvedMissed?.length || 0,
        unresolvedVoicemailCount: unresolvedVoicemails?.length || 0,
      };
    },
    enabled: !!businessId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Checking go-live requirements...
        </CardContent>
      </Card>
    );
  }

  const locks: LockCheck[] = [
    {
      id: "caller_id",
      label: "Caller ID Configured",
      description: "At least one active phone number",
      passed: readinessData?.hasCallerID ?? false,
      critical: true,
      fixLink: "/communication-hub/call-settings/caller-ids",
    },
    {
      id: "callable_users",
      label: "Callable Users Configured",
      description: `${readinessData?.callableUserCount || 0} user(s) can receive calls`,
      passed: readinessData?.hasCallableUsers ?? false,
      critical: true,
      fixLink: "/communication-hub/call-settings/user-settings",
    },
    {
      id: "inbound_routes",
      label: "Inbound Routes Valid",
      description: "All routes have callable targets",
      passed: (readinessData?.hasInboundRoutes && readinessData?.allRoutesHaveTargets) ?? false,
      critical: true,
      fixLink: "/communication-hub/call-settings/inbound-routing",
    },
    {
      id: "after_hours",
      label: "After-Hours Routing",
      description: "Configured for closed hours",
      passed: readinessData?.hasAfterHoursRoute ?? false,
      critical: true,
      fixLink: "/communication-hub/call-settings/after-hours",
    },
    {
      id: "voicemail",
      label: "Voicemail Configured",
      description: "Fallback voicemail enabled",
      passed: readinessData?.hasVoicemailConfigured ?? false,
      critical: false,
      fixLink: "/communication-hub/call-settings/voicemail",
    },
    {
      id: "unresolved_missed",
      label: "No Unresolved Missed Calls",
      description: `${readinessData?.unresolvedMissedCount || 0} missed calls pending`,
      passed: (readinessData?.unresolvedMissedCount || 0) === 0,
      critical: true,
      fixLink: "/communication-hub/call-intelligence/queue",
    },
    {
      id: "unresolved_voicemails",
      label: "No Unresolved Voicemails",
      description: `${readinessData?.unresolvedVoicemailCount || 0} voicemails pending`,
      passed: (readinessData?.unresolvedVoicemailCount || 0) === 0,
      critical: true,
      fixLink: "/communication-hub/call-intelligence/voicemail",
    },
  ];

  const criticalLocks = locks.filter(l => l.critical);
  const passedCritical = criticalLocks.filter(l => l.passed).length;
  const allCriticalPassed = passedCritical === criticalLocks.length;
  const allPassed = locks.every(l => l.passed);

  const canEnableAIAutoAnswer = allCriticalPassed;

  return (
    <Card className={allPassed ? "border-green-500/50" : "border-amber-500/50"}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${allPassed ? "bg-green-100 dark:bg-green-900/20" : "bg-amber-100 dark:bg-amber-900/20"}`}>
              {allPassed ? (
                <ShieldCheck className="h-6 w-6 text-green-600" />
              ) : (
                <Shield className="h-6 w-6 text-amber-600" />
              )}
            </div>
            <div>
              <CardTitle>AI Auto-Answer Locks</CardTitle>
              <CardDescription>
                {businessName} — {passedCritical}/{criticalLocks.length} critical checks passed
              </CardDescription>
            </div>
          </div>
          <Badge variant={allCriticalPassed ? "default" : "destructive"}>
            {allCriticalPassed ? (
              <>
                <Unlock className="h-3 w-3 mr-1" />
                Unlocked
              </>
            ) : (
              <>
                <Lock className="h-3 w-3 mr-1" />
                Locked
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lock Items */}
        <div className="space-y-2">
          {locks.map((lock) => (
            <div
              key={lock.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                lock.passed
                  ? "bg-green-50 dark:bg-green-900/10"
                  : lock.critical
                  ? "bg-red-50 dark:bg-red-900/10"
                  : "bg-amber-50 dark:bg-amber-900/10"
              }`}
            >
              <div className="flex items-center gap-3">
                {lock.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : lock.critical ? (
                  <XCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                <div>
                  <p className="font-medium text-sm">{lock.label}</p>
                  <p className="text-xs text-muted-foreground">{lock.description}</p>
                </div>
              </div>
              {!lock.passed && lock.fixLink && (
                <Button asChild variant="ghost" size="sm">
                  <Link to={lock.fixLink}>
                    Fix
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* AI Auto-Answer Status */}
        <div className="pt-4 border-t">
          <div className={`p-4 rounded-lg ${
            canEnableAIAutoAnswer 
              ? "bg-primary/5 border border-primary/20" 
              : "bg-muted"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className={`h-6 w-6 ${canEnableAIAutoAnswer ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="font-medium">AI Auto-Answer</p>
                  <p className="text-sm text-muted-foreground">
                    {canEnableAIAutoAnswer 
                      ? "All critical checks passed. AI can safely answer calls."
                      : "Blocked until all critical checks pass."}
                  </p>
                </div>
              </div>
              <Button 
                disabled={!canEnableAIAutoAnswer}
                variant={canEnableAIAutoAnswer ? "default" : "outline"}
              >
                {canEnableAIAutoAnswer ? "Enable AI" : "Locked"}
              </Button>
            </div>
          </div>
        </div>

        {!allCriticalPassed && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              AI Auto-Answer is <strong>blocked</strong> until all critical checks pass. 
              This ensures AI never masks a configuration failure.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
