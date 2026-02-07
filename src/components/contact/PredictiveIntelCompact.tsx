/**
 * PredictiveIntelCompact — Minimal Phase III intel for field portals & route planning
 * 
 * Single-line: "Suggested: Text · Best: 10am–1pm"
 * Used alongside StoreContactIntelBadge in compact views.
 */

import { usePredictiveContactIntelligence } from '@/hooks/usePredictiveContactIntelligence';
import { SuggestedChannelBadge } from './SuggestedChannelBadge';
import { ResponsivenessHeatInsight } from './ResponsivenessHeatInsight';
import { cn } from '@/lib/utils';

interface PredictiveIntelCompactProps {
  storeId: string;
  className?: string;
}

export function PredictiveIntelCompact({ storeId, className }: PredictiveIntelCompactProps) {
  const { intelligence, isLoading } = usePredictiveContactIntelligence(storeId);

  if (isLoading || !intelligence) return null;

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <SuggestedChannelBadge recommendation={intelligence.channelRecommendation} />
      <ResponsivenessHeatInsight heat={intelligence.timeOfDayHeat} compact />
    </div>
  );
}
