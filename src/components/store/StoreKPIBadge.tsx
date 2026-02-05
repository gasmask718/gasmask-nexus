import { Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StoreKPISummary } from '@/hooks/useStoreTubeKPIBatch';
import { getTubeBrandColor } from '@/constants/tubeColors';
import { getColorStatusClasses } from '@/hooks/useStoreTubeKPI';

// ═══════════════════════════════════════════════════════════════════════════════
// STORE KPI BADGE (PER-BRAND BREAKDOWN)
// Displays tube inventory per brand inline on Store Directory cards
// ALL products visible - NO truncation
// ═══════════════════════════════════════════════════════════════════════════════

interface StoreKPIBadgeProps {
  summary: StoreKPISummary | undefined;
  isLoading?: boolean;
}

export function StoreKPIBadge({ summary, isLoading }: StoreKPIBadgeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
        <Package className="h-3 w-3" />
        <span>Loading...</span>
      </div>
    );
  }

  // No data / not verified
  if (!summary || !summary.verified) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="h-3 w-3" />
        <span>KPI Missing</span>
      </div>
    );
  }

  // No tube inventory records
  if (summary.brandCount === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Package className="h-3 w-3" />
        <span>No tube data</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      {/* Header with total */}
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground font-medium">
          <Package className="h-3 w-3" />
          Tube Inventory
        </span>
        <span className="text-muted-foreground font-mono text-[10px]">
          {summary.totalTubes} total
        </span>
      </div>

      {/* ALL products - NO truncation */}
      <div className="space-y-1.5">
        {summary.kpiRows.map(row => {
          const brandColor = getTubeBrandColor(row.brand_id);
          const statusColors = getColorStatusClasses(row.color_status);
          const isOutOfStock = row.tube_count === 0;
          const isNeverOrdered = row.last_order_label === 'Never ordered';

          return (
            <div
              key={row.brand_id}
              className={cn(
                'rounded-md px-2 py-1.5 text-xs',
                statusColors.bg,
                'border',
                statusColors.border
              )}
            >
              {/* Brand name + tube count */}
              <div className="flex items-center justify-between">
                <span 
                  className="font-medium text-xs"
                  style={{ color: brandColor.hex }}
                >
                  {row.brand_name}
                </span>
                <span 
                  className="font-mono text-xs"
                  style={{ color: brandColor.hex }}
                >
                  {row.tube_count} tubes
                </span>
              </div>

              {/* Last order date - per product */}
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  Last order:
                </span>
                <span className={cn(
                  'text-[10px] font-medium',
                  isNeverOrdered ? 'text-amber-500' : 'text-muted-foreground'
                )}>
                  {row.last_order_date 
                    ? new Date(row.last_order_date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })
                    : row.last_order_label || 'Never ordered'
                  }
                </span>
              </div>

              {/* Status warnings inline */}
              {isOutOfStock && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-destructive">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  <span>Out of stock</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
