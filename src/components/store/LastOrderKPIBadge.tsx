import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { dynastyDate } from '@/lib/dates';
import type { LastOrderSnapshot } from '@/hooks/useLastOrderSnapshot';
import { getBrandIdentity } from '@/config/brands';

interface LastOrderKPIBadgeProps {
  snapshots: LastOrderSnapshot[] | undefined;
  compact?: boolean;
  className?: string;
}

/**
 * Compact KPI badge showing the latest order across all brands,
 * with a tooltip breakdown per brand.
 */
export function LastOrderKPIBadge({ snapshots, compact, className }: LastOrderKPIBadgeProps) {
  if (!snapshots || snapshots.length === 0) {
    return (
      <Badge variant="outline" className={`text-xs text-muted-foreground ${className || ''}`}>
        <ShoppingCart className="h-3 w-3 mr-1" />
        No orders yet
      </Badge>
    );
  }

  // Find latest order across all brands (exclude placeholders)
  const actualOrders = snapshots.filter(s => !s.is_placeholder);
  const sorted = [...snapshots].sort((a, b) => {
    // Actual orders first, then placeholders
    if (a.is_placeholder !== b.is_placeholder) return a.is_placeholder ? 1 : -1;
    return new Date(b.last_order_date).getTime() - new Date(a.last_order_date).getTime();
  });
  const latest = actualOrders.length > 0
    ? actualOrders.sort((a, b) => new Date(b.last_order_date).getTime() - new Date(a.last_order_date).getTime())[0]
    : null;

  if (!latest) {
    // All brands are placeholders — no orders at all
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`text-xs text-muted-foreground cursor-default ${className || ''}`}>
              <ShoppingCart className="h-3 w-3 mr-1" />
              No orders yet
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold text-xs mb-1">Last Orders by Brand</p>
              {sorted.map((snap) => {
                const brand = snap.canonical_brand_id ? getBrandIdentity(snap.canonical_brand_id) : null;
                return (
                  <div key={snap.brand_key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">{brand?.icon} {brand?.shortName || snap.brand_name}</span>
                    <span className="text-muted-foreground">Never ordered</span>
                  </div>
                );
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const brandIdentity = latest.canonical_brand_id
    ? getBrandIdentity(latest.canonical_brand_id)
    : null;

  const statusColor =
    latest.days_since_last_order <= 14
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
      : latest.days_since_last_order <= 30
        ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
        : 'bg-red-500/10 text-red-600 border-red-500/30';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-xs cursor-default ${statusColor} ${className || ''}`}>
            <ShoppingCart className="h-3 w-3 mr-1" />
            {compact ? (
              <span>{latest.days_since_last_order}d · {latest.last_order_size_label}</span>
            ) : (
              <span>
                {dynastyDate(latest.last_order_date)} · {latest.last_order_size_label}
                <span className="text-muted-foreground ml-1">({latest.days_since_last_order}d)</span>
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-xs mb-1">Last Orders by Brand</p>
            {sorted.map((snap) => {
              const brand = snap.canonical_brand_id
                ? getBrandIdentity(snap.canonical_brand_id)
                : null;
              return (
                <div key={snap.brand_key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium">
                    {brand?.icon} {brand?.shortName || snap.brand_name}
                  </span>
                  <span className="text-muted-foreground">
                    {snap.is_placeholder
                      ? 'Never ordered'
                      : `${dynastyDate(snap.last_order_date)} · ${snap.last_order_size_label} · ${snap.days_since_last_order}d ago`
                    }
                  </span>
                </div>
              );
            })}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
