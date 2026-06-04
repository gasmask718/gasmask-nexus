/**
 * Hub-wide alert stack. Mounted by <DDShell /> at the top of every
 * Dynasty Direct page. Surfaces live problems with per-alert snooze.
 */
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, X, ChevronRight } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useDDAlerts } from '@/hooks/useDDAlerts';
import { DD_SNOOZE_OPTIONS, SEVERITY_STYLES } from '@/lib/dynastyDirect/thresholds';
import { cn } from '@/lib/utils';

export function DDAlertBar() {
  const { alerts, snooze } = useDDAlerts();
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-4">
      {alerts.map((a) => {
        const sty = SEVERITY_STYLES[a.severity];
        const Body = (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className={cn('h-2 w-2 rounded-full flex-shrink-0 animate-pulse', sty.dot)} />
            <AlertTriangle className="h-4 w-4 flex-shrink-0 opacity-80" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{a.title}</div>
              <div className="text-xs opacity-80 truncate">{a.detail}</div>
            </div>
          </div>
        );
        return (
          <div
            key={a.id}
            className={cn(
              'flex items-center gap-2 border rounded-md px-3 py-2',
              sty.bar
            )}
          >
            {a.href ? (
              <Link to={a.href} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90">
                {Body}
                <ChevronRight className="h-4 w-4 opacity-60 flex-shrink-0" />
              </Link>
            ) : Body}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 px-2 hover:bg-white/10">
                  <Clock className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {DD_SNOOZE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.label}
                    onClick={() => snooze(a.id, opt.minutes, a.resolvedKey)}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-white/10"
              onClick={() => snooze(a.id, 60, a.resolvedKey)}
              title="Dismiss (snooze 1h)"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
