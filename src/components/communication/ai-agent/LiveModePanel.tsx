import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, XCircle, Power, Radio, Shield, TrendingUp } from "lucide-react";
import { useLiveModeGate, useEnableLiveMode, useDisableLiveMode, useLiveKillSwitch, useRealtimeModeTransitions } from "@/hooks/useLiveMode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LiveModePanelProps {
  businessId: string;
  className?: string;
}

/**
 * LiveModePanel - Main control panel for Live Mode
 * Absolute authority for admin controls
 */
export function LiveModePanel({ businessId, className }: LiveModePanelProps) {
  const [confirmingEnable, setConfirmingEnable] = useState(false);
  
  const { data: gateResult, isLoading } = useLiveModeGate(businessId);
  const enableMutation = useEnableLiveMode(businessId);
  const disableMutation = useDisableLiveMode(businessId);
  const killSwitchMutation = useLiveKillSwitch(businessId);

  // Subscribe to realtime updates
  useRealtimeModeTransitions(businessId);

  const isLive = gateResult?.mode === "live" && gateResult?.allowed;
  const canEnableLive = gateResult?.allowed && gateResult?.blockers?.length === 0;

  const handleEnableLive = async () => {
    if (!confirmingEnable) {
      setConfirmingEnable(true);
      return;
    }

    try {
      await enableMutation.mutateAsync();
      toast.success("Live Mode enabled - AI is now answering calls");
      setConfirmingEnable(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enable Live Mode");
      setConfirmingEnable(false);
    }
  };

  const handleDisableLive = async () => {
    try {
      await disableMutation.mutateAsync("Admin manually disabled Live Mode");
      toast.success("Live Mode disabled - reverting to Canary Mode");
    } catch (error) {
      toast.error("Failed to disable Live Mode");
    }
  };

  const handleKillSwitch = async () => {
    try {
      await killSwitchMutation.mutateAsync(true);
      toast.warning("KILL SWITCH ACTIVATED - All AI answering stopped immediately");
    } catch (error) {
      toast.error("Kill switch failed - contact support immediately");
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(isLive && "border-destructive border-2", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className={cn("h-6 w-6", isLive ? "text-destructive" : "text-muted-foreground")} />
            <div>
              <CardTitle className="flex items-center gap-2">
                Live Mode Control
                {isLive && (
                  <Badge variant="destructive" className="animate-pulse">
                    ACTIVE
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Full AI answering with continuous audits
              </CardDescription>
            </div>
          </div>

          {/* Kill Switch - Always visible when live */}
          {isLive && (
            <Button
              variant="destructive"
              size="lg"
              onClick={handleKillSwitch}
              className="gap-2"
              disabled={killSwitchMutation.isPending}
            >
              <Power className="h-5 w-5" />
              KILL SWITCH
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Entry Requirements Checklist */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Entry Requirements
          </h4>

          <div className="space-y-2">
            {/* Trust Score */}
            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                {(gateResult?.metrics?.trust_score || 0) >= (gateResult?.metrics?.trust_threshold || 92) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm">Trust Score ≥ {gateResult?.metrics?.trust_threshold || 92}%</span>
              </div>
              <Badge variant="outline">
                {(gateResult?.metrics?.trust_score || 0).toFixed(1)}%
              </Badge>
            </div>

            {/* Override Rate */}
            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                {(gateResult?.metrics?.override_rate || 0) <= (gateResult?.metrics?.max_override_rate || 10) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm">Override Rate ≤ {gateResult?.metrics?.max_override_rate || 10}%</span>
              </div>
              <Badge variant="outline">
                {(gateResult?.metrics?.override_rate || 0).toFixed(1)}%
              </Badge>
            </div>

            {/* Consecutive Failures */}
            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                {(gateResult?.metrics?.consecutive_failures || 0) === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm">Zero Consecutive Failures</span>
              </div>
              <Badge variant="outline">
                {gateResult?.metrics?.consecutive_failures || 0}
              </Badge>
            </div>

            {/* Callable Humans */}
            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                {(gateResult?.metrics?.callable_humans || 0) > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm">Human Fallback Available</span>
              </div>
              <Badge variant="outline">
                {gateResult?.metrics?.callable_humans || 0} users
              </Badge>
            </div>
          </div>
        </div>

        {/* Blockers */}
        {gateResult?.blockers && gateResult.blockers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Blockers ({gateResult.blockers.length})
            </h4>
            <ul className="space-y-1">
              {gateResult.blockers.map((blocker, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-destructive" />
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="live-mode-toggle" className="text-base font-medium">
              Enable Live Mode
            </Label>
            <p className="text-sm text-muted-foreground">
              AI will answer calls autonomously. Requires all gates to pass.
            </p>
          </div>

          {isLive ? (
            <Button
              variant="outline"
              onClick={handleDisableLive}
              disabled={disableMutation.isPending}
            >
              Disable Live Mode
            </Button>
          ) : (
            <Button
              variant={confirmingEnable ? "destructive" : "default"}
              onClick={handleEnableLive}
              disabled={!canEnableLive || enableMutation.isPending}
            >
              {confirmingEnable ? "Click Again to Confirm" : "Enable Live Mode"}
            </Button>
          )}
        </div>

        {/* Warning */}
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-600">Production Warning</p>
              <p className="text-muted-foreground mt-1">
                Live Mode means AI speaks directly to callers. All decisions are logged 
                and auditable. The system will auto-downgrade on failures.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default LiveModePanel;