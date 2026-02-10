import { AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EscalationFlag } from '@/hooks/useEscalationFlags';

interface EscalationFlagBadgeProps {
  flag: EscalationFlag;
  compact?: boolean;
  className?: string;
}

const severityConfig = {
  high: {
    icon: AlertOctagon,
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-600',
  },
  medium: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600',
  },
  low: {
    icon: Info,
    bg: 'bg-muted',
    border: 'border-muted-foreground/20',
    text: 'text-muted-foreground',
  },
} as const;

export function EscalationFlagBadge({ flag, compact, className }: EscalationFlagBadgeProps) {
  const config = severityConfig[flag.severity];
  const Icon = config.icon;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
          config.bg, config.border, config.text,
          className
        )}
      >
        <Icon className="h-2.5 w-2.5" />
        {flag.label}
      </span>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start gap-1.5 text-xs p-1.5 rounded',
        config.bg,
        className
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', config.text)} />
      <span className={cn('font-medium', config.text)}>{flag.label}</span>
    </div>
  );
}
