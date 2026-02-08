// ═══════════════════════════════════════════════════════════════
// Store Health Badge — Compact health indicator for Store Profile
// Shows: Score, Status emoji, and tooltip with dimension breakdown
// ═══════════════════════════════════════════════════════════════

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStoreHealthScore } from '@/hooks/useStoreHealth';
import { getHealthStatusConfig } from '@/lib/delivery/storeHealthEngine';
import { cn } from '@/lib/utils';

interface StoreHealthBadgeProps {
  storeId: string;
  className?: string;
  showScore?: boolean;
}

export function StoreHealthBadge({ storeId, className, showScore = true }: StoreHealthBadgeProps) {
  const { data: health, isLoading } = useStoreHealthScore(storeId);

  if (isLoading || !health) return null;

  const config = getHealthStatusConfig(health.healthStatus);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(config.bg, 'cursor-help gap-1.5', className)}
          >
            <span>{config.emoji}</span>
            <span className={config.color}>{config.label}</span>
            {showScore && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {health.overallScore}
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1.5">
            <p className="font-semibold text-sm">
              Store Health: {health.overallScore}/100
            </p>
            {health.dimensions && health.dimensions.length > 0 && (
              <div className="space-y-1">
                {health.dimensions.map((d: any) => (
                  <div key={d.dimension} className="flex justify-between text-xs gap-3">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-mono">{d.score}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground pt-1">
              {health.totalVisits30d} visits in last 30 days
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
