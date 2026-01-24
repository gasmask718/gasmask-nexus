import { AlertTriangle, Radio, Shield, Power } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LiveModeBannerProps {
  mode: string;
  isLiveActive: boolean;
  activeCalls?: number;
  onKillSwitch?: () => void;
  className?: string;
}

/**
 * LiveModeBanner - Serious status indicator for Live Mode
 * This should feel serious, not playful.
 */
export function LiveModeBanner({
  mode,
  isLiveActive,
  activeCalls = 0,
  onKillSwitch,
  className,
}: LiveModeBannerProps) {
  if (mode !== "live" && !isLiveActive) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border-2",
        isLiveActive
          ? "bg-destructive/10 border-destructive"
          : "bg-muted border-border",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {/* Pulsing indicator */}
        <div className="relative">
          <div
            className={cn(
              "h-4 w-4 rounded-full",
              isLiveActive ? "bg-destructive" : "bg-muted-foreground"
            )}
          />
          {isLiveActive && (
            <div className="absolute inset-0 h-4 w-4 rounded-full bg-destructive animate-ping" />
          )}
        </div>

        {/* Status text */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive" />
            <span className="text-lg font-bold text-destructive">
              🔴 LIVE MODE ACTIVE
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            AI is answering calls autonomously
          </span>
        </div>

        {/* Active calls badge */}
        {activeCalls > 0 && (
          <Badge variant="destructive" className="text-sm">
            {activeCalls} AI-handled call{activeCalls !== 1 ? "s" : ""} active
          </Badge>
        )}
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Auto-escalation enabled</span>
        </div>

        {/* Emergency kill switch */}
        {onKillSwitch && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onKillSwitch}
            className="gap-2"
          >
            <Power className="h-4 w-4" />
            KILL SWITCH
          </Button>
        )}
      </div>
    </div>
  );
}

export default LiveModeBanner;