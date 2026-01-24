import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bot,
  User,
  AlertTriangle,
  Power,
  Volume2,
  VolumeX,
  Shield,
  Zap,
  AlertOctagon,
  PhoneOff,
} from "lucide-react";

export type CallAgentState =
  | "ai_speaking"
  | "ai_listening"
  | "ai_muted"
  | "human_active"
  | "handoff_pending"
  | "kill_switch_active"
  | "confidence_breach"
  | "escalated"
  | "ringing"
  | "ended";

interface CallStatusBannerProps {
  state: CallAgentState;
  confidence?: number;
  confidenceThreshold?: number;
  killSwitchReason?: string;
  handoffReason?: string;
  onKillSwitch?: () => void;
  onTakeOver?: () => void;
  className?: string;
}

const stateConfig: Record<
  CallAgentState,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    bgClass: string;
    textClass: string;
    borderClass: string;
    pulse?: boolean;
  }
> = {
  ai_speaking: {
    label: "🤖 AI SPEAKING",
    description: "AI is actively responding to the caller",
    icon: Bot,
    bgClass: "bg-primary/10",
    textClass: "text-primary",
    borderClass: "border-primary",
    pulse: true,
  },
  ai_listening: {
    label: "🎧 AI LISTENING",
    description: "AI is processing caller speech",
    icon: Volume2,
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-600",
    borderClass: "border-blue-500",
  },
  ai_muted: {
    label: "🔇 AI MUTED",
    description: "AI is muted - human must respond",
    icon: VolumeX,
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-600",
    borderClass: "border-amber-500",
  },
  human_active: {
    label: "👤 HUMAN ACTIVE",
    description: "A human operator is handling this call",
    icon: User,
    bgClass: "bg-green-500/10",
    textClass: "text-green-600",
    borderClass: "border-green-500",
  },
  handoff_pending: {
    label: "⏳ HANDOFF PENDING",
    description: "Transferring to human operator...",
    icon: AlertTriangle,
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-600",
    borderClass: "border-amber-500",
    pulse: true,
  },
  kill_switch_active: {
    label: "🛑 KILL SWITCH ACTIVE",
    description: "Emergency stop - all AI answering disabled",
    icon: Power,
    bgClass: "bg-destructive/20",
    textClass: "text-destructive",
    borderClass: "border-destructive",
    pulse: true,
  },
  confidence_breach: {
    label: "⚠️ CONFIDENCE BREACH",
    description: "AI confidence dropped below threshold - escalating",
    icon: AlertOctagon,
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
    borderClass: "border-destructive",
    pulse: true,
  },
  escalated: {
    label: "🚨 ESCALATED",
    description: "Call escalated to human due to risk triggers",
    icon: Shield,
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
    borderClass: "border-destructive",
  },
  ringing: {
    label: "📞 RINGING",
    description: "Incoming call - routing in progress",
    icon: Zap,
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-600",
    borderClass: "border-blue-500",
    pulse: true,
  },
  ended: {
    label: "📴 CALL ENDED",
    description: "This call has been completed",
    icon: PhoneOff,
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-muted",
  },
};

export function CallStatusBanner({
  state,
  confidence,
  confidenceThreshold,
  killSwitchReason,
  handoffReason,
  onKillSwitch,
  onTakeOver,
  className,
}: CallStatusBannerProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4",
        config.bgClass,
        config.borderClass,
        className
      )}
    >
      <div className="flex items-center justify-between">
        {/* Left: Status indicator */}
        <div className="flex items-center gap-4">
          {/* Pulsing dot for active states */}
          <div className="relative">
            <div className={cn("h-4 w-4 rounded-full", config.bgClass.replace("/10", "").replace("/20", ""))} />
            {config.pulse && (
              <div
                className={cn(
                  "absolute inset-0 h-4 w-4 rounded-full animate-ping",
                  config.bgClass.replace("/10", "/50").replace("/20", "/50")
                )}
              />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Icon className={cn("h-5 w-5", config.textClass)} />
              <span className={cn("text-lg font-bold", config.textClass)}>
                {config.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        {/* Right: Actions and additional info */}
        <div className="flex items-center gap-4">
          {/* Confidence display for AI states */}
          {confidence !== undefined && (state === "ai_speaking" || state === "ai_listening") && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Confidence</div>
              <div
                className={cn(
                  "font-bold",
                  confidence >= (confidenceThreshold || 70) ? "text-green-600" : "text-destructive"
                )}
              >
                {confidence}%
              </div>
            </div>
          )}

          {/* Take over button for AI states */}
          {(state === "ai_speaking" || state === "ai_listening") && onTakeOver && (
            <Button variant="outline" size="sm" onClick={onTakeOver}>
              <User className="h-4 w-4 mr-2" />
              Take Over
            </Button>
          )}

          {/* Kill switch for active AI states */}
          {(state === "ai_speaking" || state === "ai_listening" || state === "ringing") &&
            onKillSwitch && (
              <Button variant="destructive" size="sm" onClick={onKillSwitch}>
                <Power className="h-4 w-4 mr-2" />
                KILL SWITCH
              </Button>
            )}
        </div>
      </div>

      {/* Additional context alerts */}
      {state === "kill_switch_active" && killSwitchReason && (
        <Alert variant="destructive" className="mt-3">
          <AlertOctagon className="h-4 w-4" />
          <AlertDescription>
            <strong>Reason:</strong> {killSwitchReason}
          </AlertDescription>
        </Alert>
      )}

      {state === "handoff_pending" && handoffReason && (
        <Alert className="mt-3 border-amber-500/50 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Handoff reason:</strong> {handoffReason}
          </AlertDescription>
        </Alert>
      )}

      {state === "confidence_breach" && confidence !== undefined && confidenceThreshold !== undefined && (
        <Alert variant="destructive" className="mt-3">
          <AlertOctagon className="h-4 w-4" />
          <AlertDescription>
            Confidence dropped to <strong>{confidence}%</strong> (threshold: {confidenceThreshold}%).
            AI speech has been aborted and call is being transferred to a human.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default CallStatusBanner;
