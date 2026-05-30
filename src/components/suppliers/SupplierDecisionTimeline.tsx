import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useCostTrendProjection } from '@/hooks/useSupplierIntelligence';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface SupplierDecisionTimelineProps {
  supplier: string;
}

export function SupplierDecisionTimeline({ supplier }: SupplierDecisionTimelineProps) {
  const { data, isLoading } = useCostTrendProjection(supplier);

  if (isLoading) return null;
  if (!data?.length) return null;

  // Use the most recent product entry as representative
  const latest: any = data[0];
  const lastDate = latest?.last_received_at ? new Date(latest.last_received_at) : null;
  const now = new Date();
  const d30 = new Date(now.getTime() + 30 * 86400000);
  const d60 = new Date(now.getTime() + 60 * 86400000);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Decision Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-xs">
          {lastDate && (
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground">Last Receipt</span>
              <span className="font-medium">{format(lastDate, 'MMM d, yyyy')}</span>
            </div>
          )}
          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 h-1.5 bg-muted rounded-full relative">
            <div className="absolute left-1/3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-400" title="30-day projection" />
            <div className="absolute left-2/3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-400" title="60-day projection" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-muted-foreground">30d</span>
            <span className="font-medium">{format(d30, 'MMM d, yyyy')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-muted-foreground">60d</span>
            <span className="font-medium">{format(d60, 'MMM d, yyyy')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
