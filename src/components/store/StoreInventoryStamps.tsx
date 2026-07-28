/**
 * SHARED inventory timestamp display — rendered identically on the store
 * PROFILE (UnifiedTubeIntelligenceCard) and the store KPI CARD (Stores grid).
 *
 * Never duplicate this markup: import it.
 */

import { Clock, Eye } from 'lucide-react';
import { dynastyStamp, dynastyStampWithRelative, dynastyRelative } from '@/lib/dates';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useReviewerNames } from '@/components/store/StoreReviewControls';
import { cn } from '@/lib/utils';

interface Props {
  lastUpdated?: string | null;
  lastChecked?: string | null;
  checkedBy?: string | null;
  /** compact = KPI card (no relative suffix on counts, tighter text) */
  compact?: boolean;
  className?: string;
}

export function StoreInventoryStamps({
  lastUpdated,
  lastChecked,
  checkedBy,
  compact = false,
  className,
}: Props) {
  const names = useReviewerNames([checkedBy]);
  if (!lastUpdated && !lastChecked) return null;

  const who = (checkedBy && names?.[checkedBy]) || null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground',
        compact ? 'text-[10px]' : 'text-xs',
        className,
      )}
    >
      {lastUpdated && (
        <span className="flex items-center gap-1.5">
          <Clock className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
          Counts updated:{' '}
          <span className="text-foreground font-medium">
            {compact ? dynastyStamp(lastUpdated) : dynastyStampWithRelative(lastUpdated)}
          </span>
        </span>
      )}
      {lastChecked && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1.5">
                <Eye className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                Inventory checked:{' '}
                <span className="text-foreground font-medium">{dynastyStamp(lastChecked)}</span>
                {who && !compact && <span className="opacity-80">· {who}</span>}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div>Inventory checked {dynastyStamp(lastChecked)}</div>
                <div className="opacity-80">{dynastyRelative(lastChecked)}</div>
                {who && <div className="opacity-80">by {who}</div>}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
