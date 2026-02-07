/**
 * PredictiveIntelPanel — Phase III combined intelligence panel
 * 
 * Combines all three predictive layers into a single, compact card section.
 * Used in Store Profile and Quick Stats. Read-only, advisory only.
 */

import { Brain } from 'lucide-react';
import { usePredictiveContactIntelligence } from '@/hooks/usePredictiveContactIntelligence';
import { SuggestedChannelBadge } from './SuggestedChannelBadge';
import { ResponsivenessHeatInsight } from './ResponsivenessHeatInsight';
import { ContactSequenceList } from './ContactSequenceList';
import { cn } from '@/lib/utils';

interface PredictiveIntelPanelProps {
  storeId: string;
  variant?: 'full' | 'compact';
  className?: string;
}

export function PredictiveIntelPanel({ storeId, variant = 'full', className }: PredictiveIntelPanelProps) {
  const { intelligence, isLoading } = usePredictiveContactIntelligence(storeId);

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Predictive Intelligence</p>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-6 bg-muted/30 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!intelligence) return null;

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-1.5', className)}>
        <div className="flex items-center gap-2 flex-wrap">
          <SuggestedChannelBadge recommendation={intelligence.channelRecommendation} />
          <ResponsivenessHeatInsight heat={intelligence.timeOfDayHeat} compact />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5 text-primary" />
        <p className="text-sm font-medium">Predictive Intelligence</p>
        <span className="text-xs text-muted-foreground ml-auto">Advisory</span>
      </div>

      {/* ① Suggested Channel */}
      <SuggestedChannelBadge recommendation={intelligence.channelRecommendation} />

      {/* ② Time-of-Day Heat */}
      <ResponsivenessHeatInsight heat={intelligence.timeOfDayHeat} />

      {/* ③ Contact Sequence */}
      <ContactSequenceList sequence={intelligence.contactSequence} />
    </div>
  );
}
