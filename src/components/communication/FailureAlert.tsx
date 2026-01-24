import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  XCircle,
  RefreshCw,
  Settings,
  Users,
  Wifi,
  FileWarning,
  ShieldOff,
} from "lucide-react";
import { Link } from "react-router-dom";

export type FailureType =
  | "missing_config"
  | "no_callable_humans"
  | "ai_api_failure"
  | "audit_write_failure"
  | "routing_mismatch"
  | "kill_switch_active"
  | "authorization_expired"
  | "trust_score_low";

interface FailureAlertProps {
  type: FailureType;
  details?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const failureConfig: Record<
  FailureType,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    severity: "error" | "warning";
    fixLink?: string;
    fixLabel?: string;
    fallback: string;
  }
> = {
  missing_config: {
    title: "Missing Configuration",
    description: "AI agent configuration not found for this business.",
    icon: Settings,
    severity: "error",
    fixLink: "/communication-hub/call-intelligence/ai-agent",
    fixLabel: "Configure AI Agent",
    fallback: "Calls will be routed to human operators only.",
  },
  no_callable_humans: {
    title: "No Callable Humans Available",
    description: "No users are configured to receive calls. AI cannot operate without human fallback.",
    icon: Users,
    severity: "error",
    fixLink: "/communication-hub/call-settings/user-settings",
    fixLabel: "Configure Users",
    fallback: "Calls will go to voicemail.",
  },
  ai_api_failure: {
    title: "AI Service Unavailable",
    description: "The AI service is not responding. This may be a temporary issue.",
    icon: Wifi,
    severity: "error",
    fallback: "Calls are being routed to human operators.",
  },
  audit_write_failure: {
    title: "Audit Logging Failure",
    description: "Decision logs are not being written. This is a compliance issue.",
    icon: FileWarning,
    severity: "error",
    fallback: "AI answering is disabled until audit logging is restored.",
  },
  routing_mismatch: {
    title: "Routing Configuration Error",
    description: "Inbound call routes have invalid or missing targets.",
    icon: AlertTriangle,
    severity: "warning",
    fixLink: "/communication-hub/call-settings/inbound-routing",
    fixLabel: "Fix Routes",
    fallback: "Affected calls will use the default fallback route.",
  },
  kill_switch_active: {
    title: "Kill Switch Active",
    description: "AI answering has been manually disabled via emergency kill switch.",
    icon: ShieldOff,
    severity: "error",
    fixLink: "/communication-hub/call-intelligence/ai-agent?tab=governance",
    fixLabel: "Manage Kill Switch",
    fallback: "All calls are being routed to human operators.",
  },
  authorization_expired: {
    title: "Live Mode Authorization Expired",
    description: "The admin authorization for Live Mode has expired.",
    icon: XCircle,
    severity: "warning",
    fixLink: "/communication-hub/call-intelligence/ai-agent?tab=governance",
    fixLabel: "Renew Authorization",
    fallback: "AI is operating in Canary or Assisted mode.",
  },
  trust_score_low: {
    title: "Trust Score Below Threshold",
    description: "AI trust score has dropped below the required threshold for Live Mode.",
    icon: AlertTriangle,
    severity: "warning",
    fixLink: "/communication-hub/call-intelligence/ai-agent",
    fixLabel: "View Trust Score",
    fallback: "AI has been automatically downgraded to a safer mode.",
  },
};

export function FailureAlert({
  type,
  details,
  onRetry,
  onDismiss,
  className,
}: FailureAlertProps) {
  const config = failureConfig[type];
  const Icon = config.icon;

  return (
    <Alert
      variant={config.severity === "error" ? "destructive" : "default"}
      className={`${
        config.severity === "warning"
          ? "border-amber-500/50 bg-amber-500/5 text-amber-900 dark:text-amber-100"
          : ""
      } ${className}`}
    >
      <Icon className="h-5 w-5" />
      <AlertTitle className="flex items-center gap-2">
        {config.title}
        <Badge variant={config.severity === "error" ? "destructive" : "secondary"}>
          {config.severity === "error" ? "Critical" : "Warning"}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{config.description}</p>
        
        {details && (
          <p className="text-sm opacity-80">
            <strong>Details:</strong> {details}
          </p>
        )}

        <div className="p-2 rounded bg-background/50 text-sm">
          <strong>Fallback:</strong> {config.fallback}
        </div>

        <div className="flex items-center gap-2 pt-2">
          {config.fixLink && (
            <Button asChild size="sm" variant="outline">
              <Link to={config.fixLink}>
                <Settings className="h-4 w-4 mr-2" />
                {config.fixLabel || "Fix This"}
              </Link>
            </Button>
          )}
          
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
          
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default FailureAlert;
