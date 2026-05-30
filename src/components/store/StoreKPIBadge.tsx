import { Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StoreKPISummary } from '@/hooks/useStoreTubeKPIBatch';
import type { TubeIntelSummary } from '@/hooks/useStoreTubeIntelSummary';
import { TUBE_BRAND_COLORS, getTubeBrandColor } from '@/constants/tubeColors';
import { getColorStatusClasses } from '@/hooks/useStoreTubeKPI';
import { Skeleton } from '@/components/ui/skeleton';
import { TubeIntelAttribution } from '@/components/store/TubeIntelAttribution';
import { normalizeBrandId, CANONICAL_BRANDS } from '@/config/brands';

// ═══════════════════════════════════════════════════════════════════════════════
// STORE KPI BADGE — CANONICAL RENDERER
// ALWAYS renders ALL known brands — even if data is missing
// NO truncation. NO hiding. Full operational visibility.
// Dedupe legacy duplicate brand ids (e.g. 'grabba' + 'grabba_r_us') by collapsing
// into their canonical brand. Distinct SKU variants (gasmask vs gasmasktubes,
// hotscolatti light/dark) stay separate.
// ═══════════════════════════════════════════════════════════════════════════════

interface StoreKPIBadgeProps {
  summary: StoreKPISummary | undefined;
  isLoading?: boolean;
  intelSummary?: TubeIntelSummary | null;
}

// Group key: canonical id ONLY when the raw key is an exact alias of a
// canonical brand (so 'grabba' → 'grabba_r_us'). SKU variants like
// 'gasmasktubes' or 'hotscolatti-light' keep their raw key.
function groupKeyFor(rawId: string): string {
  const canon = normalizeBrandId(rawId);
  if (canon && CANONICAL_BRANDS[canon].aliases.some(a => a.toLowerCase() === rawId.toLowerCase())) {
    return canon;
  }
  return rawId;
}

// Canonical brand list — deduped by group key, preserving order.
const ALL_TUBE_BRANDS = (() => {
  const seen = new Set<string>();
  const out: { brand_id: string; brand_name: string }[] = [];
  for (const [id, config] of Object.entries(TUBE_BRAND_COLORS)) {
    const key = groupKeyFor(id);
    if (seen.has(key)) continue;
    seen.add(key);
    const canon = normalizeBrandId(key);
    const name = canon && key === canon ? CANONICAL_BRANDS[canon].displayName : config.name;
    out.push({ brand_id: key, brand_name: name });
  }
  return out;
})();

export function StoreKPIBadge({ summary, isLoading, intelSummary }: StoreKPIBadgeProps) {
  // Loading state — show skeleton for all brands
  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="h-3 w-3" />
          <span className="font-medium">Tube Inventory</span>
        </div>
        <div className="space-y-1.5">
          {ALL_TUBE_BRANDS.map(brand => (
            <Skeleton key={brand.brand_id} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  // Build lookup map from existing KPI data — merge rows that share a group key
  // (sum tube_count, take most-recent last_order_date, prefer non-muted status).
  const kpiLookup = new Map<string, { brand_id: string; brand_name: string; tube_count: number; last_order_date: string | null; color_status: string }>();
  for (const row of summary?.kpiRows || []) {
    const key = groupKeyFor(row.brand_id);
    const existing = kpiLookup.get(key);
    if (!existing) {
      kpiLookup.set(key, {
        brand_id: key,
        brand_name: row.brand_name,
        tube_count: Number(row.tube_count || 0),
        last_order_date: row.last_order_date ?? null,
        color_status: row.color_status || 'muted',
      });
    } else {
      existing.tube_count += Number(row.tube_count || 0);
      if (row.last_order_date && (!existing.last_order_date || row.last_order_date > existing.last_order_date)) {
        existing.last_order_date = row.last_order_date;
      }
      if (existing.color_status === 'muted' && row.color_status) existing.color_status = row.color_status;
    }
  }

  // Calculate total tubes across all brands
  const totalTubes = summary?.totalTubes ?? 0;

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      {/* Header with total */}
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground font-medium">
          <Package className="h-3 w-3" />
          Tube Inventory
        </span>
        <span className="text-muted-foreground font-mono text-[10px]">
          {totalTubes} total
        </span>
      </div>

      {/* Tube Intel Attribution — additive, non-destructive */}
      <TubeIntelAttribution summary={intelSummary} compact className="pb-1" />

      {/* ALL brands — ALWAYS rendered, NO truncation */}
      <div className="space-y-1.5">
        {ALL_TUBE_BRANDS.map(brand => {
          const kpi = kpiLookup.get(brand.brand_id);
          const brandColor = getTubeBrandColor(brand.brand_id);
          
          // Derive status: if we have KPI data use it, otherwise default to muted
          const colorStatus = (kpi?.color_status || 'muted') as 'green' | 'yellow' | 'red' | 'muted';
          const statusColors = getColorStatusClasses(colorStatus);
          
          const tubeCount = kpi?.tube_count ?? 0;
          const lastOrderDate = kpi?.last_order_date;
          const isOutOfStock = tubeCount === 0;
          const isNeverOrdered = !lastOrderDate;

          return (
            <div
              key={brand.brand_id}
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
                  {brand.brand_name}
                </span>
                <span 
                  className="font-mono text-xs"
                  style={{ color: brandColor.hex }}
                >
                  Tube count: {tubeCount}
                </span>
              </div>

              {/* Last order date — per product */}
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  Last order:
                </span>
                <span className={cn(
                  'text-[10px] font-medium',
                  isNeverOrdered ? 'text-amber-500' : 'text-muted-foreground'
                )}>
                  {lastOrderDate 
                    ? new Date(lastOrderDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })
                    : 'Never ordered'
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
