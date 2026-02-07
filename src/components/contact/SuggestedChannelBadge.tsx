/**
 * SuggestedChannelBadge — Phase III Advisory badge
 * 
 * Shows: "Suggested: Text" or "Suggested: Call" with confidence + hover explanation.
 * READ-ONLY. No actions. Purely advisory.
 */

import { MessageSquare, Phone, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChannelRecommendation } from '@/hooks/usePredictiveContactIntelligence';
import { cn } from '@/lib/utils';

interface SuggestedChannelBadgeProps {
  recommendation: ChannelRecommendation | undefined;
  className?: string;
}

export function SuggestedChannelBadge({ recommendation, className }: SuggestedChannelBadgeProps) {
  if (!recommendation || recommendation.suggested === 'none') {
    return (
      <div className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}>
        <HelpCircle className="h-3 w-3" />
        <span>No channel preference</span>
      </div>
    );
  }

  const Icon = recommendation.suggested === 'text' ? MessageSquare : Phone;
  const label = recommendation.suggested === 'text' ? 'Text' : 'Call';

  const confidenceColor = 
    recommendation.confidence === 'high' ? 'text-green-600 bg-green-500/10 border-green-500/20' :
    recommendation.confidence === 'medium' ? 'text-amber-600 bg-amber-500/10 border-amber-500/20' :
    'text-muted-foreground bg-muted/30 border-border/30';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium cursor-default',
            confidenceColor,
            className
          )}>
            <Icon className="h-3 w-3" />
            <span>Suggested: {label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <p className="text-xs">{recommendation.reason}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Confidence: {recommendation.confidence}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
