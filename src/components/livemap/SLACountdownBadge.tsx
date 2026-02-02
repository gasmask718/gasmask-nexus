// ═══════════════════════════════════════════════════════════════════════════════
// SLA COUNTDOWN BADGE — Visual time pressure indicator
// Phase 3.6 enhancement
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SLACountdownBadgeProps {
  slaDeadline: string | Date | null;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

export function SLACountdownBadge({ 
  slaDeadline, 
  className,
  showIcon = true,
  compact = false,
}: SLACountdownBadgeProps) {
  const { text, status, pulsing } = useMemo(() => {
    if (!slaDeadline) return { text: null, status: 'unknown', pulsing: false };

    const deadline = typeof slaDeadline === 'string' ? new Date(slaDeadline) : slaDeadline;
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes < -60) {
      return { 
        text: compact ? `+${Math.abs(Math.round(diffMinutes / 60))}h` : `Overdue +${Math.round(Math.abs(diffMinutes) / 60)}h`,
        status: 'critical',
        pulsing: true,
      };
    }
    
    if (diffMinutes < 0) {
      return { 
        text: compact ? `+${Math.abs(diffMinutes)}m` : `Overdue +${Math.abs(diffMinutes)}m`,
        status: 'critical',
        pulsing: true,
      };
    }
    
    if (diffMinutes <= 15) {
      return { 
        text: compact ? `T-${diffMinutes}m` : `T-${diffMinutes}m`,
        status: 'warning',
        pulsing: true,
      };
    }
    
    if (diffMinutes <= 30) {
      return { 
        text: compact ? `T-${diffMinutes}m` : `T-${diffMinutes}m`,
        status: 'caution',
        pulsing: false,
      };
    }
    
    if (diffMinutes <= 60) {
      return { 
        text: compact ? `T-${diffMinutes}m` : `T-${diffMinutes}m`,
        status: 'ok',
        pulsing: false,
      };
    }

    return { 
      text: compact ? `T-${Math.round(diffMinutes / 60)}h` : `T-${Math.round(diffMinutes / 60)}h ${diffMinutes % 60}m`,
      status: 'safe',
      pulsing: false,
    };
  }, [slaDeadline, compact]);

  if (!text) return null;

  const statusStyles = {
    critical: 'bg-red-500/20 text-red-500 border-red-500/50',
    warning: 'bg-orange-500/20 text-orange-500 border-orange-500/50',
    caution: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/50',
    ok: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
    safe: 'bg-green-500/20 text-green-500 border-green-500/50',
    unknown: 'bg-muted text-muted-foreground',
  };

  const Icon = status === 'critical' || status === 'warning' ? AlertTriangle : Clock;

  return (
    <Badge 
      variant="outline"
      className={cn(
        statusStyles[status as keyof typeof statusStyles],
        pulsing && 'animate-pulse',
        'font-mono text-xs',
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {text}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLA RISK INDICATOR — Route-level SLA risk glow effect
// ═══════════════════════════════════════════════════════════════════════════════

interface SLARiskIndicatorProps {
  hasRisk: boolean;
  level: 'low' | 'medium' | 'high' | 'critical';
  className?: string;
}

export function SLARiskIndicator({ hasRisk, level, className }: SLARiskIndicatorProps) {
  if (!hasRisk) return null;

  const glowColors = {
    low: 'shadow-green-500/20',
    medium: 'shadow-yellow-500/30',
    high: 'shadow-orange-500/40',
    critical: 'shadow-red-500/50 animate-pulse',
  };

  return (
    <div 
      className={cn(
        'absolute inset-0 rounded-lg pointer-events-none',
        'ring-1',
        level === 'critical' ? 'ring-red-500/50' :
        level === 'high' ? 'ring-orange-500/40' :
        level === 'medium' ? 'ring-yellow-500/30' :
        'ring-green-500/20',
        glowColors[level],
        className
      )}
    />
  );
}
