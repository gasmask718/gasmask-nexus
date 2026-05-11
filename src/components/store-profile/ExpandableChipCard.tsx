import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ExpandableChipCardProps {
  collapsedView: ReactNode;
  expandedView: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  expandedClassName?: string;
  ariaLabel?: string;
  expandedTitle?: string;
}

/**
 * Tap-to-expand chip card. Use anywhere a glanceable aggregate
 * benefits from a per-category breakdown without navigation.
 */
export function ExpandableChipCard({
  collapsedView,
  expandedView,
  isLoading,
  isEmpty,
  emptyMessage = 'No data available',
  className,
  expandedClassName,
  ariaLabel = 'Toggle detail view',
  expandedTitle,
}: ExpandableChipCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn(expanded && (expandedClassName ?? 'md:col-span-2 lg:col-span-2'), className)}>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={ariaLabel}
          aria-expanded={expanded}
          className="w-full text-left p-4 hover:bg-muted/40 transition-colors rounded-lg"
        >
          {!expanded ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">{collapsedView}</div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {expandedTitle ?? 'Breakdown'}
                </span>
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </div>
              {isLoading ? (
                <p className="py-2 text-xs text-muted-foreground">Loading…</p>
              ) : isEmpty ? (
                <p className="py-2 text-xs text-muted-foreground italic">{emptyMessage}</p>
              ) : (
                expandedView
              )}
            </div>
          )}
        </button>
      </CardContent>
    </Card>
  );
}

export default ExpandableChipCard;
