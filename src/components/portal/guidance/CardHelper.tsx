/**
 * CardHelper - Expandable card-level micro guide
 * Provides context about what a card shows and how to use it
 */
import { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CardHelperProps {
  /** Brief explanation shown inline or on hover */
  summary: string;
  /** Detailed explanation shown when expanded */
  details?: string;
  /** How the data is calculated/sourced */
  dataSource?: string;
  /** What actions affect this card */
  affectedBy?: string[];
  /** Display variant */
  variant?: 'inline' | 'tooltip' | 'expandable';
  className?: string;
}

export function CardHelper({ 
  summary, 
  details, 
  dataSource, 
  affectedBy,
  variant = 'inline',
  className 
}: CardHelperProps) {
  const { t, isRTL } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (variant === 'tooltip') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={cn('inline-flex items-center justify-center', className)}>
              <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
            </button>
          </TooltipTrigger>
          <TooltipContent side={isRTL ? 'left' : 'right'} className="max-w-xs">
            <p className="text-sm">{summary}</p>
            {dataSource && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('guidance.data_from') || 'Data from'}: {dataSource}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (variant === 'expandable') {
    return (
      <div className={cn('border-b border-border/30 bg-muted/30', className)}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors',
            isRTL && 'flex-row-reverse'
          )}
        >
          <Info className="h-3 w-3" />
          <span className="flex-1 text-left">{summary}</span>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        
        {isExpanded && (
          <div className={cn('px-3 pb-3 space-y-2', isRTL && 'text-right')}>
            {details && (
              <p className="text-xs text-muted-foreground">{details}</p>
            )}
            {dataSource && (
              <p className="text-xs">
                <span className="text-muted-foreground">{t('guidance.data_from') || 'Data from'}:</span>{' '}
                <span className="font-medium">{dataSource}</span>
              </p>
            )}
            {affectedBy && affectedBy.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">{t('guidance.affected_by') || 'Affected by'}:</span>
                <ul className="mt-1 space-y-0.5">
                  {affectedBy.map((action, idx) => (
                    <li key={idx} className="text-muted-foreground pl-2">• {action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Default: inline variant
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 border-b border-border/30',
      isRTL && 'flex-row-reverse',
      className
    )}>
      <Info className="h-3 w-3 shrink-0" />
      <span>{summary}</span>
    </div>
  );
}
