import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Power,
  History,
  User,
} from "lucide-react";
import {
  useCurrentAuthorization,
  useAuthorizationHistory,
  useKillSwitchStates,
  useAuditEvents,
  useAuthorizeLiveMode,
  useRevokeAuthorization,
  useActivateKillSwitch,
  useDeactivateKillSwitch,
  useExportAuditData,
  useRealtimeKillSwitch,
} from "@/hooks/useLiveModeGovernance";
import { useLiveModeGate } from "@/hooks/useLiveMode";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface GovernancePanelProps {
  businessId: string;
  userId: string;
  className?: string;
}

export function GovernancePanel({ businessId, userId, className }: GovernancePanelProps) {
  const [justification, setJustification] = useState("");
  const [showAuthHistory, setShowAuthHistory] = useState(false);

  const { data: currentAuth } = useCurrentAuthorization(businessId);
  const { data: authHistory } = useAuthorizationHistory(businessId);
  const { data: killStates } = useKillSwitchStates(businessId);
  const { data: auditEvents } = useAuditEvents(businessId, 20);
  const { data: gateResult } = useLiveModeGate(businessId);

  const authorizeMutation = useAuthorizeLiveMode(businessId);
  const revokeMutation = useRevokeAuthorization(businessId);
  const activateKillMutation = useActivateKillSwitch();
  const deactivateKillMutation = useDeactivateKillSwitch();
  const exportMutation = useExportAuditData(businessId);

  useRealtimeKillSwitch(businessId);

  const isLiveAuthorized = currentAuth?.status === "approved" && 
    (!currentAuth.expires_at || new Date(currentAuth.expires_at) > new Date());
  
  const anyKillSwitchActive = 
    killStates?.global?.is_active || 
    killStates?.business?.is_active;

  const handleAuthorize = async () => {
    await authorizeMutation.mutateAsync({
      justification,
      authorizedBy: userId,
    });
    setJustification("");
  };

  const handleRevoke = async () => {
    if (!currentAuth) return;
    await revokeMutation.mutateAsync({
      authorizationId: currentAuth.id,
      revokedBy: userId,
      reason: "Manual revocation by admin",
    });
  };

  const handleGlobalKillSwitch = async () => {
    if (killStates?.global?.is_active) {
      await deactivateKillMutation.mutateAsync({
        scope: "global",
        deactivatedBy: userId,
      });
    } else {
      await activateKillMutation.mutateAsync({
        scope: "global",
        reason: "Manual activation by admin",
        activatedBy: userId,
      });
    }
  };

  const handleBusinessKillSwitch = async () => {
    if (killStates?.business?.is_active) {
      await deactivateKillMutation.mutateAsync({
        scope: "business",
        businessId,
        deactivatedBy: userId,
      });
    } else {
      await activateKillMutation.mutateAsync({
        scope: "business",
        businessId,
        reason: "Manual activation by admin",
        activatedBy: userId,
      });
    }
  };

  const handleExport = () => {
    exportMutation.mutate({
      redactPii: true,
      includeTranscripts: false,
    });
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Authorization Status */}
      <Card className={cn(
        "border-2",
        isLiveAuthorized && !anyKillSwitchActive && "border-green-500",
        anyKillSwitchActive && "border-destructive"
      )}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLiveAuthorized && !anyKillSwitchActive ? (
                <ShieldCheck className="h-5 w-5 text-green-500" />
              ) : anyKillSwitchActive ? (
                <ShieldAlert className="h-5 w-5 text-destructive" />
              ) : (
                <Shield className="h-5 w-5 text-muted-foreground" />
              )}
              Live Mode Authorization
            </div>
            <Badge variant={
              anyKillSwitchActive ? "destructive" :
              isLiveAuthorized ? "default" : "secondary"
            }>
              {anyKillSwitchActive ? "KILL SWITCH ACTIVE" :
               isLiveAuthorized ? "AUTHORIZED" : "NOT AUTHORIZED"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Explicit admin approval required for Live Mode
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Authorization Details */}
          {currentAuth && isLiveAuthorized && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Authorization</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(currentAuth.authorized_at!), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{currentAuth.justification}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Trust: {currentAuth.trust_score_at_approval}%</span>
                <span>Accuracy: {currentAuth.accuracy_rate_at_approval}%</span>
                {currentAuth.expires_at && (
                  <span className="text-amber-600">
                    Expires: {formatDistanceToNow(new Date(currentAuth.expires_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevoke}
                disabled={revokeMutation.isPending}
                className="mt-2"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Revoke Authorization
              </Button>
            </div>
          )}

          {/* Authorization Form */}
          {!isLiveAuthorized && !anyKillSwitchActive && (
            <div className="space-y-4">
              {/* Blockers */}
              {gateResult?.blockers && gateResult.blockers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Blockers ({gateResult.blockers.length})
                  </Label>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {gateResult.blockers.map((b, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-destructive" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="justification">Authorization Justification</Label>
                <Textarea
                  id="justification"
                  placeholder="Explain why Live Mode should be enabled (required for audit trail)"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <Button
                onClick={handleAuthorize}
                disabled={
                  !justification.trim() ||
                  authorizeMutation.isPending ||
                  (gateResult?.blockers?.length || 0) > 0
                }
                className="w-full"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Authorize Live Mode
              </Button>
            </div>
          )}

          {/* History Toggle */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAuthHistory(!showAuthHistory)}
            >
              <History className="h-4 w-4 mr-1" />
              {showAuthHistory ? "Hide" : "Show"} History
            </Button>
            <span className="text-xs text-muted-foreground">
              {authHistory?.length || 0} total authorizations
            </span>
          </div>

          {/* Authorization History */}
          {showAuthHistory && (
            <ScrollArea className="h-[200px] border rounded-lg p-3">
              {authHistory?.map((auth) => (
                <div
                  key={auth.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={auth.status === "approved" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {auth.status}
                    </Badge>
                    <span className="text-sm truncate max-w-[200px]">
                      {auth.justification}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(auth.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Kill Switches */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Power className="h-5 w-5" />
            Emergency Kill Switches
          </CardTitle>
          <CardDescription>
            Instantly stop AI answering. No redeploy required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global Kill Switch */}
          <div className="flex items-center justify-between p-4 rounded-lg border-2 border-destructive/30 bg-destructive/5">
            <div>
              <div className="font-medium flex items-center gap-2">
                🌍 Global Kill Switch
                {killStates?.global?.is_active && (
                  <Badge variant="destructive" className="animate-pulse">ACTIVE</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Stops ALL AI answering across all businesses
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant={killStates?.global?.is_active ? "outline" : "destructive"}
                  size="sm"
                >
                  {killStates?.global?.is_active ? "Deactivate" : "Activate"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">
                    {killStates?.global?.is_active ? "Deactivate" : "Activate"} Global Kill Switch?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {killStates?.global?.is_active
                      ? "This will allow AI answering to resume across all businesses."
                      : "This will IMMEDIATELY stop ALL AI call answering and transfer all active calls to humans."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleGlobalKillSwitch}
                    className={killStates?.global?.is_active ? "" : "bg-destructive"}
                  >
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Business Kill Switch */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div>
              <div className="font-medium flex items-center gap-2">
                🏢 Business Kill Switch
                {killStates?.business?.is_active && (
                  <Badge variant="destructive">ACTIVE</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Stops AI answering for this business only
              </p>
            </div>
            <Button
              variant={killStates?.business?.is_active ? "outline" : "destructive"}
              size="sm"
              onClick={handleBusinessKillSwitch}
              disabled={activateKillMutation.isPending || deactivateKillMutation.isPending}
            >
              {killStates?.business?.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Audit Events
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exportMutation.isPending}
            >
              <Download className="h-4 w-4 mr-1" />
              Export All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {auditEvents?.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    event.event_severity === "emergency" && "border-destructive bg-destructive/5",
                    event.event_severity === "critical" && "border-amber-500 bg-amber-500/5",
                    event.event_severity === "warning" && "border-yellow-500 bg-yellow-500/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          event.event_severity === "emergency" ? "destructive" :
                          event.event_severity === "critical" ? "destructive" :
                          event.event_severity === "warning" ? "secondary" : "outline"
                        }
                        className="text-xs"
                      >
                        {event.event_type.replace(/_/g, " ")}
                      </Badge>
                      {event.triggered_by && (
                        <span className="text-xs text-muted-foreground">
                          by {event.triggered_by}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {event.trust_score_at_event && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Trust: {event.trust_score_at_event}%
                      {event.confidence_at_event && ` · Confidence: ${event.confidence_at_event}%`}
                    </div>
                  )}
                </div>
              ))}
              {(!auditEvents || auditEvents.length === 0) && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No audit events yet
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
