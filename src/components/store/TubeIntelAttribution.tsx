import { cn } from '@/lib/utils';
import { MapPin, Phone, MessageSquare, Monitor, AlertTriangle, Clock } from 'lucide-react';
import { formatDistanceToNow, differenceInDays, format } from 'date-fns';
import { dynastyDate } from '@/lib/dates';
import type { TubeIntelSummary, UpdateMethod } from '@/hooks/useStoreTubeIntelSummary';

// ═══════════════════════════════════════════════════════════════════════════════
// TUBE INTEL ATTRIBUTION — ADDITIVE KPI OVERLAY
// Shows freshness + provenance on any Store KPI card.
// Does NOT modify, replace, or remove existing KPIs.
// ═══════════════════════════════════════════════════════════════════════════════

const STALE_THRESHOLD_DAYS = 7;

const METHOD_CONFIG: Record<UpdateMethod, {
  label: string;
  shortLabel: string;
  icon: typeof MapPin;
  className: string;
}> = {
  in_person: {
    label: 'In-Person',
    shortLabel: 'In-Person',
    icon: MapPin,
    className: 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400',
  },
  call: {
    label: 'Call',
    shortLabel: 'Call',
    icon: Phone,
    className: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400',
  },
  text: {
    label: 'Text',
    shortLabel: 'Text',
    icon: MessageSquare,
    className: 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400',
  },
  system: {
    label: 'System',
    shortLabel: 'System',
    icon: Monitor,
    className: 'bg-muted text-muted-foreground border-border',
  },
};

interface TubeIntelAttributionProps {
  summary: TubeIntelSummary | null | undefined;
  /** Compact mode for tight card layouts */
  compact?: boolean;
  className?: string;
}

export function TubeIntelAttribution({ summary, compact = false, className }: TubeIntelAttributionProps) {
  // No data at all — legacy/unknown
  if (!summary || !summary.most_recent_update) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 text-[10px] text-muted-foreground',
        className
      )}>
        <Clock className="h-2.5 w-2.5 flex-shrink-0" />
        <span>Tube Intel: Legacy / Unknown</span>
      </div>
    );
  }

  const mostRecent = new Date(summary.most_recent_update);
  const oldest = summary.oldest_update ? new Date(summary.oldest_update) : mostRecent;
  const daysSinceMostRecent = differenceInDays(new Date(), mostRecent);
  const daysSinceOldest = differenceInDays(new Date(), oldest);
  const isStale = daysSinceMostRecent >= STALE_THRESHOLD_DAYS;
  const isMixed = summary.method_count > 1;
  const singleMethod = !isMixed && summary.methods.length === 1 ? summary.methods[0] : null;

  // Stale warning — takes priority
  if (isStale) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400',
        className
      )}>
        <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />
        <span>⚠️ Tube Intel stale · {daysSinceMostRecent}d</span>
      </div>
    );
  }

  // Mixed methods
  if (isMixed) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 text-[10px] text-muted-foreground',
        className
      )}>
        <Clock className="h-2.5 w-2.5 flex-shrink-0" />
        <span>Tube Intel: Mixed</span>
        <span className="text-muted-foreground/70">
          · Oldest {daysSinceOldest}d ago
        </span>
        {/* Show method pills */}
        <span className="flex items-center gap-0.5 ml-0.5">
          {summary.methods.map(m => {
            const cfg = METHOD_CONFIG[m];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <span
                key={m}
                className={cn(
                  'inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] border',
                  cfg.className
                )}
                title={cfg.label}
              >
                <Icon className="h-2 w-2" />
                {!compact && cfg.shortLabel}
              </span>
            );
          })}
        </span>
      </div>
    );
  }

  // Single method — clean attribution line
  const methodCfg = singleMethod ? METHOD_CONFIG[singleMethod] : null;
  const MethodIcon = methodCfg?.icon || Clock;
  const dateLabel = compact
    ? dynastyDate(mostRecent)
    : dynastyDate(mostRecent);
  const relativeLabel = formatDistanceToNow(mostRecent, { addSuffix: false });

  return (
    <div className={cn(
      'flex items-center gap-1.5 text-[10px] text-muted-foreground',
      className
    )}>
      <Clock className="h-2.5 w-2.5 flex-shrink-0" />
      <span>Tube Intel: {dateLabel}</span>
      <span className="text-muted-foreground/60">({relativeLabel} ago)</span>
      {methodCfg && (
        <span
          className={cn(
            'inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] border',
            methodCfg.className
          )}
        >
          <MethodIcon className="h-2 w-2" />
          {methodCfg.shortLabel}
        </span>
      )}
    </div>
  );
}
