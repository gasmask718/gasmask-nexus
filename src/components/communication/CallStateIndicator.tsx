import { 
  Phone, 
  Mic, 
  MicOff, 
  User, 
  AlertTriangle, 
  PhoneOff,
  Loader2,
  Hand,
  Volume2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CallState } from "@/hooks/useCallStateAuthority";

/**
 * CALL STATE INDICATOR
 * ====================
 * Visual representation of the authoritative call state.
 * 
 * Shows:
 * - Current state with icon
 * - Who is allowed to speak
 * - Lock status
 * - Active speaker
 */

interface CallStateIndicatorProps {
  state: CallState | null | undefined;
  activeSpeaker?: 'ai' | 'human' | 'caller' | 'none';
  isLocked?: boolean;
  lockReason?: string | null;
  showSpeaker?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const stateConfig: Record<CallState, {
  label: string;
  icon: typeof Phone;
  color: string;
  bgColor: string;
  description: string;
}> = {
  ringing: {
    label: "Ringing",
    icon: Phone,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    description: "Incoming call - AI waiting",
  },
  ai_listening: {
    label: "AI Listening",
    icon: Mic,
    color: "text-green-600",
    bgColor: "bg-green-100",
    description: "AI is listening to caller",
  },
  ai_speaking: {
    label: "AI Speaking",
    icon: Volume2,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    description: "AI is actively speaking",
  },
  handoff_pending: {
    label: "Handoff Pending",
    icon: Hand,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    description: "Waiting for human to take over",
  },
  human_active: {
    label: "Human Active",
    icon: User,
    color: "text-blue-700",
    bgColor: "bg-blue-200",
    description: "Human operator has control",
  },
  ai_muted: {
    label: "AI Muted",
    icon: MicOff,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    description: "AI speech is disabled",
  },
  escalated: {
    label: "Escalated",
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    description: "Call has been escalated",
  },
  ended: {
    label: "Ended",
    icon: PhoneOff,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    description: "Call has ended",
  },
};

const speakerLabels: Record<string, { label: string; color: string }> = {
  ai: { label: "AI Speaking", color: "text-purple-600" },
  human: { label: "Human Speaking", color: "text-blue-600" },
  caller: { label: "Caller Speaking", color: "text-green-600" },
  none: { label: "Silent", color: "text-muted-foreground" },
};

export function CallStateIndicator({
  state,
  activeSpeaker = 'none',
  isLocked = false,
  lockReason,
  showSpeaker = true,
  size = 'md',
  className,
}: CallStateIndicatorProps) {
  if (!state) {
    return (
      <Badge variant="outline" className={cn("gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading...</span>
      </Badge>
    );
  }

  const config = stateConfig[state];
  const Icon = config.icon;
  const speaker = speakerLabels[activeSpeaker];

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Main state badge */}
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className={cn(
            "gap-1.5 font-medium border-0",
            config.bgColor,
            config.color,
            sizeClasses[size]
          )}
        >
          <Icon className={iconSizes[size]} />
          <span>{config.label}</span>
        </Badge>

        {/* Lock indicator */}
        {isLocked && (
          <Badge variant="destructive" className={cn("gap-1", sizeClasses[size])}>
            <AlertTriangle className={iconSizes[size]} />
            <span>Locked</span>
          </Badge>
        )}
      </div>

      {/* Active speaker (if shown) */}
      {showSpeaker && activeSpeaker !== 'none' && (
        <span className={cn("text-xs", speaker.color)}>
          🔊 {speaker.label}
        </span>
      )}

      {/* Lock reason */}
      {isLocked && lockReason && (
        <span className="text-xs text-destructive">
          {lockReason}
        </span>
      )}
    </div>
  );
}

// Compact inline version for tables/lists
export function CallStateInline({
  state,
  showIcon = true,
  className,
}: {
  state: CallState | null | undefined;
  showIcon?: boolean;
  className?: string;
}) {
  if (!state) return <span className="text-muted-foreground">—</span>;

  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1", config.color, className)}>
      {showIcon && <Icon className="h-3 w-3" />}
      <span className="text-xs font-medium">{config.label}</span>
    </span>
  );
}

// State badge with description tooltip
export function CallStateBadge({
  state,
  size = 'md',
}: {
  state: CallState;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config = stateConfig[state];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "h-6 text-xs",
    md: "h-8 text-sm",
    lg: "h-10 text-base",
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1.5 font-medium border-0",
        config.bgColor,
        config.color,
        sizeClasses[size]
      )}
      title={config.description}
    >
      <Icon className="h-4 w-4" />
      <span>{config.label}</span>
    </Badge>
  );
}
