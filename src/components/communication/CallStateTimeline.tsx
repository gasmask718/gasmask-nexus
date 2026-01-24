import { format } from "date-fns";
import { 
  Phone, 
  Mic, 
  MicOff, 
  User, 
  AlertTriangle, 
  PhoneOff,
  Hand,
  Volume2,
  ArrowRight,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { StateTransition, CallState } from "@/hooks/useCallStateAuthority";

/**
 * CALL STATE TIMELINE
 * ===================
 * Visual timeline of state transitions for a call.
 * Used for audit/replay and operator understanding.
 */

interface CallStateTimelineProps {
  transitions: StateTransition[];
  isLoading?: boolean;
  className?: string;
}

const stateIcons: Record<CallState, typeof Phone> = {
  ringing: Phone,
  ai_listening: Mic,
  ai_speaking: Volume2,
  handoff_pending: Hand,
  human_active: User,
  ai_muted: MicOff,
  escalated: AlertTriangle,
  ended: PhoneOff,
};

const stateColors: Record<CallState, string> = {
  ringing: "bg-blue-500",
  ai_listening: "bg-green-500",
  ai_speaking: "bg-purple-500",
  handoff_pending: "bg-yellow-500",
  human_active: "bg-blue-600",
  ai_muted: "bg-orange-500",
  escalated: "bg-red-500",
  ended: "bg-gray-400",
};

export function CallStateTimeline({
  transitions,
  isLoading,
  className,
}: CallStateTimelineProps) {
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (transitions.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-8 text-muted-foreground", className)}>
        No state transitions recorded
      </div>
    );
  }

  return (
    <ScrollArea className={cn("max-h-[400px]", className)}>
      <div className="relative pl-6 pr-4 py-2">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />

        {transitions.map((transition, index) => {
          const ToIcon = stateIcons[transition.to_state];
          const FromIcon = transition.from_state ? stateIcons[transition.from_state] : null;
          const toColor = stateColors[transition.to_state];
          const isLast = index === transitions.length - 1;

          return (
            <div key={transition.id} className="relative pb-6 last:pb-0">
              {/* Timeline dot */}
              <div 
                className={cn(
                  "absolute left-[-11px] w-6 h-6 rounded-full flex items-center justify-center",
                  toColor
                )}
              >
                <ToIcon className="h-3 w-3 text-white" />
              </div>

              {/* Content */}
              <div className="ml-6">
                {/* State transition header */}
                <div className="flex items-center gap-2 flex-wrap">
                  {transition.from_state && FromIcon && (
                    <>
                      <Badge variant="outline" className="text-xs">
                        {transition.from_state.replace('_', ' ')}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </>
                  )}
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs border-0", toColor.replace('bg-', 'bg-opacity-20 text-'))}
                    style={{ 
                      backgroundColor: `${toColor.replace('bg-', '')}20`,
                    }}
                  >
                    {transition.to_state.replace('_', ' ')}
                  </Badge>

                  {/* Speech interrupted badge */}
                  {transition.speech_interrupted && (
                    <Badge variant="destructive" className="text-xs">
                      Speech Interrupted
                    </Badge>
                  )}
                </div>

                {/* Trigger info */}
                <div className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium">{transition.transition_trigger}</span>
                  {transition.triggered_by && (
                    <span> by {transition.triggered_by}</span>
                  )}
                </div>

                {/* Metadata */}
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {format(new Date(transition.created_at), "HH:mm:ss.SSS")}
                  </span>
                  {transition.latency_ms && (
                    <span className="text-blue-600">
                      {transition.latency_ms}ms
                    </span>
                  )}
                  {transition.confidence_at_transition && (
                    <span className={cn(
                      transition.confidence_at_transition < 0.7 ? "text-red-600" : "text-green-600"
                    )}>
                      Confidence: {(transition.confidence_at_transition * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Trigger details (if any) */}
                {transition.trigger_details && Object.keys(transition.trigger_details).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Details
                    </summary>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(transition.trigger_details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
