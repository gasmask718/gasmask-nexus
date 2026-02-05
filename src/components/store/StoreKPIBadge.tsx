import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StoreKPISummary } from '@/hooks/useStoreTubeKPIBatch';
import { getTubeBrandColor } from '@/constants/tubeColors';
import { getColorStatusClasses } from '@/hooks/useStoreTubeKPI';

// ═══════════════════════════════════════════════════════════════════════════════
// STORE KPI BADGE (PER-BRAND BREAKDOWN)
// Displays tube inventory per brand inline on Store Directory cards
// ═══════════════════════════════════════════════════════════════════════════════

interface StoreKPIBadgeProps {
  summary: StoreKPISummary | undefined;
  isLoading?: boolean;
  maxBrands?: number; // How many brands to show before "+X more"
}

export function StoreKPIBadge({ summary, isLoading, maxBrands = 4 }: StoreKPIBadgeProps) {
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

  const visibleBrands = summary.kpiRows.slice(0, maxBrands);
  const remainingCount = Math.max(0, summary.kpiRows.length - maxBrands);

  return (
    <div className="space-y-1.5 pt-2 border-t border-border/50">
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

       {/* Per-brand breakdown */}
       <div className="flex flex-wrap gap-1">
         {visibleBrands.map(row => {
           const brandColor = getTubeBrandColor(row.brand_id);
           const statusColors = getColorStatusClasses(row.color_status);
           return (
             <Badge
               key={row.brand_id}
               variant="outline"
               className={cn(
                 'text-[10px] px-1.5 py-0.5',
                 statusColors.bg,
                 statusColors.border
               )}
             >
               <span className="font-medium" style={{ color: brandColor.hex }}>
                 {row.brand_name}
               </span>
               <span className="ml-1 font-mono" style={{ color: brandColor.hex }}>
                 {row.tube_count}
               </span>
             </Badge>
           );
         })}
        {remainingCount > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
            +{remainingCount} more
          </Badge>
        )}
      </div>

      {/* Status warnings */}
      {(summary.hasOutOfStock || summary.hasNeverOrdered) && (
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {summary.hasOutOfStock && (
            <span className="text-destructive flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              Out of stock
            </span>
          )}
          {summary.hasNeverOrdered && (
            <span className="text-warning flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              Never ordered
            </span>
          )}
        </div>
      )}
    </div>
  );
}
