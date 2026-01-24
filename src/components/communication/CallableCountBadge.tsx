import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallableCountBadgeProps {
  callableCount: number;
  totalCount: number;
  role?: string;
  showWarning?: boolean;
  className?: string;
}

/**
 * Displays callable user count with visual indicators
 * 🟢 Green: At least one callable user
 * 🔴 Red: No callable users (will fall back to kiosk)
 */
export function CallableCountBadge({
  callableCount,
  totalCount,
  role,
  showWarning = true,
  className,
}: CallableCountBadgeProps) {
  const hasCallable = callableCount > 0;
  const isZeroTotal = totalCount === 0;

  const badge = (
    <Badge
      variant={hasCallable ? "default" : "destructive"}
      className={cn(
        "text-xs",
        hasCallable && "bg-green-600 hover:bg-green-700",
        className
      )}
    >
      {callableCount}/{totalCount} callable
      {!hasCallable && showWarning && (
        <AlertTriangle className="h-3 w-3 ml-1" />
      )}
    </Badge>
  );

  if (!hasCallable && showWarning) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium text-destructive">⚠️ No Callable Users</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isZeroTotal
              ? `No users exist with ${role ? `role "${role}"` : "this role"}`
              : `${totalCount} user(s) exist but none have valid phone numbers or calling enabled`
            }
          </p>
          <p className="text-xs mt-2">
            Calls will fall back to Dynasty OS Kiosk (voicemail).
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
