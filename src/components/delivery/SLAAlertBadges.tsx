// ═══════════════════════════════════════════════════════════════════════════════
// SLA ALERT BADGES — Phase 3.4 Visual-Only Lateness Indicators
// ═══════════════════════════════════════════════════════════════════════════════
// Read-only. No mutations. No enforcement. No blocking.

import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, CalendarX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SLAAlert } from '@/hooks/useSLAAlerts';

interface SLAAlertBadgesProps {
  alert: SLAAlert | null | undefined;
  compact?: boolean;
  className?: string;
}

export function SLAAlertBadges({ alert, compact = false, className }: SLAAlertBadgesProps) {
  if (!alert) return null;

  const { alerts, severity, overdue_follow_up_count, stale_opportunity_count, days_since_last_stop } = alert;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {alerts.overdue_follow_up && (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] py-0 px-1.5 font-mono',
            severity === 'red'
              ? 'bg-red-500/20 text-red-500 border-red-500/50'
              : 'bg-orange-500/20 text-orange-500 border-orange-500/50'
          )}
        >
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          {compact ? `FU ×${overdue_follow_up_count}` : `${overdue_follow_up_count} Overdue FU`}
        </Badge>
      )}

      {alerts.stale_opportunity && (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] py-0 px-1.5 font-mono',
            severity === 'red'
              ? 'bg-red-500/20 text-red-500 border-red-500/50'
              : 'bg-yellow-500/20 text-yellow-600 border-yellow-500/50'
          )}
        >
          <Clock className="h-2.5 w-2.5 mr-0.5" />
          {compact ? `Stale ×${stale_opportunity_count}` : `${stale_opportunity_count} Stale Opp`}
        </Badge>
      )}

      {alerts.missed_revisit && (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] py-0 px-1.5 font-mono',
            severity === 'red'
              ? 'bg-red-500/20 text-red-500 border-red-500/50'
              : 'bg-amber-500/20 text-amber-600 border-amber-500/50'
          )}
        >
          <CalendarX className="h-2.5 w-2.5 mr-0.5" />
          {compact
            ? (days_since_last_stop ? `${days_since_last_stop}d` : 'Never')
            : (days_since_last_stop ? `No visit ${days_since_last_stop}d` : 'Never visited')}
        </Badge>
      )}
    </div>
  );
}

/** Route-level aggregate SLA summary */
interface RouteSLASummaryProps {
  alerts: SLAAlert[];
  className?: string;
}

export function RouteSLASummary({ alerts, className }: RouteSLASummaryProps) {
  if (!alerts || alerts.length === 0) return null;

  const totalOverdueFU = alerts.reduce((sum, a) => sum + a.overdue_follow_up_count, 0);
  const totalStaleOpp = alerts.reduce((sum, a) => sum + a.stale_opportunity_count, 0);
  const totalMissedRevisit = alerts.filter(a => a.alerts.missed_revisit).length;
  const worstSeverity = alerts.some(a => a.severity === 'red') ? 'red' : 'amber';

  const parts: string[] = [];
  if (totalOverdueFU > 0) parts.push(`${totalOverdueFU} overdue FU`);
  if (totalStaleOpp > 0) parts.push(`${totalStaleOpp} stale opp`);
  if (totalMissedRevisit > 0) parts.push(`${totalMissedRevisit} missed revisit`);

  if (parts.length === 0) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] py-0 px-1.5 font-mono',
        worstSeverity === 'red'
          ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse'
          : 'bg-amber-500/20 text-amber-600 border-amber-500/50',
        className
      )}
    >
      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
      {parts.join(' • ')}
    </Badge>
  );
}
