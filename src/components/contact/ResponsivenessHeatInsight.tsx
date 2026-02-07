/**
 * ResponsivenessHeatInsight — Phase III Time-of-Day signal
 * 
 * Compact textual insight: "Most responsive: 10am–1pm · Weekdays"
 * No charts in Phase III. Degrades gracefully if data is sparse.
 */

import { Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TimeOfDayHeat } from '@/hooks/usePredictiveContactIntelligence';
import { cn } from '@/lib/utils';

interface ResponsivenessHeatInsightProps {
  heat: TimeOfDayHeat | undefined;
  compact?: boolean;
  className?: string;
}

export function ResponsivenessHeatInsight({ heat, compact = false, className }: ResponsivenessHeatInsightProps) {
  if (!heat || heat.data_quality === 'none') {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <AlertCircle className="h-3 w-3" />
        <span>No response time data</span>
      </div>
    );
  }

  if (heat.data_quality === 'sparse') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
              <Clock className="h-3 w-3" />
              <span>Limited time data · {heat.best_window}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="text-xs">
              Based on limited responses. Accuracy improves with more data.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
              <Clock className="h-3 w-3 text-blue-500" />
              <span>Best: {heat.best_window}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px]">
            <div className="space-y-1">
              <p className="text-xs font-medium">Response Time Pattern</p>
              <p className="text-xs">Window: {heat.best_window}</p>
              <p className="text-xs">{heat.best_day_type}</p>
              {heat.channel_note && <p className="text-xs">{heat.channel_note}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-1.5 text-xs">
        <TrendingUp className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <span className="font-medium">Most responsive: {heat.best_window}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-5 text-xs text-muted-foreground">
        <span>{heat.best_day_type}</span>
        {heat.channel_note && <span>· {heat.channel_note}</span>}
      </div>
    </div>
  );
}
