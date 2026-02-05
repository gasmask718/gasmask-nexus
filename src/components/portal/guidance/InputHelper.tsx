/**
 * InputHelper - Inline explanation for editable fields
 * Provides context about what an input does and validation rules
 */
import { Info, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InputHelperProps {
  /** Helper text shown below or beside the input */
  text: string;
  /** More detailed explanation on hover */
  tooltip?: string;
  /** Whether this field requires approval */
  requiresApproval?: boolean;
  /** Display variant */
  variant?: 'below' | 'inline' | 'icon';
  className?: string;
}

export function InputHelper({ 
  text, 
  tooltip,
  requiresApproval,
  variant = 'below',
  className 
}: InputHelperProps) {
  const { t, isRTL } = useTranslation();
  
  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              type="button"
              className={cn('inline-flex items-center justify-center p-1 rounded hover:bg-muted/50', className)}
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side={isRTL ? 'left' : 'right'} className="max-w-xs">
            <p className="text-sm">{text}</p>
            {tooltip && <p className="text-xs text-muted-foreground mt-1">{tooltip}</p>}
            {requiresApproval && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                {t('guidance.requires_approval') || '⚠️ Changes require admin approval'}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (variant === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <Info className="h-3 w-3" />
        <span>{text}</span>
        {requiresApproval && (
          <span className="text-amber-600 font-medium">
            ({t('guidance.needs_approval') || 'needs approval'})
          </span>
        )}
      </span>
    );
  }
  
  // Default: below variant
  return (
    <div className={cn(
      'mt-1.5 text-xs text-muted-foreground',
      isRTL && 'text-right',
      className
    )}>
      <div className={cn('flex items-start gap-1.5', isRTL && 'flex-row-reverse')}>
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <div>
          <p>{text}</p>
          {requiresApproval && (
            <p className="text-amber-600 mt-0.5 font-medium">
              {t('guidance.requires_approval') || '⚠️ Changes require admin approval'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
