/**
 * PREVIOUS DAYS — read-only history of this office's closed days.
 * Managers never silently edit history; a closed day can only be reopened by
 * an admin (existing unlock flow), which is logged.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOfficeClosedDays } from '@/hooks/useProductionFloorOps';
import { CalendarDays, Lock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function ManagerPreviousDays({ officeId }: { officeId: string }) {
  const { data: days = [], isLoading } = useOfficeClosedDays(officeId, 14);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          My previous days
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="h-16 bg-muted animate-pulse rounded-lg" />
        ) : days.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No closed days yet.</p>
        ) : (
          days.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{format(parseISO(d.close_date), 'EEE, MMM d')}</p>
                <p className="text-xs text-muted-foreground">
                  {d.total_boxes ?? 0} boxes · {d.total_tobacco_lbs ?? 0} lbs · {d.total_tubes_used ?? 0} tubes
                  {d.total_defects ? ` · ${d.total_defects} defects` : ''}
                </p>
              </div>
              {d.is_locked !== false && (
                <Badge variant="outline" className="shrink-0">
                  <Lock className="h-3 w-3 mr-1" /> Closed
                </Badge>
              )}
            </div>
          ))
        )}
        <p className="text-xs text-muted-foreground pt-1">
          Need to fix a closed day? Ask HQ to reopen it — every reopen is recorded.
        </p>
      </CardContent>
    </Card>
  );
}
