import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Clock, AlertTriangle, TrendingDown } from 'lucide-react';
import { useLastOrderSnapshot, type LastOrderSnapshot } from '@/hooks/useLastOrderSnapshot';
import { getBrandIdentity, CANONICAL_BRAND_IDS, normalizeBrandId, type CanonicalBrandId } from '@/config/brands';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import { dynastyDate } from '@/lib/dates';
interface LastOrderSnapshotPanelProps {
  storeId: string;
}

function getHealthIndicator(snap: LastOrderSnapshot) {
  if (snap.is_placeholder) {
    return { color: 'bg-muted', label: 'Never Ordered', textClass: 'text-muted-foreground' };
  }
  if (snap.total_order_count < 2 || snap.avg_days_between_orders <= 0) {
    return { color: 'bg-blue-500', label: 'New', textClass: 'text-blue-600 dark:text-blue-400' };
  }
  const ratio = snap.days_since_last_order / snap.avg_days_between_orders;
  if (ratio <= 1) {
    return { color: 'bg-emerald-500', label: 'On Track', textClass: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (ratio <= 1.5) {
    return { color: 'bg-amber-500', label: 'Late', textClass: 'text-amber-600 dark:text-amber-400' };
  }
  return { color: 'bg-red-500', label: 'Overdue', textClass: 'text-red-600 dark:text-red-400' };
}

export function LastOrderSnapshotPanel({ storeId }: LastOrderSnapshotPanelProps) {
  const { data: snapshots, isLoading } = useLastOrderSnapshot(storeId);

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Hook now returns all brands with coverage — use directly
  const ordered = snapshots || [];

  if (ordered.length === 0) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Last Order Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No order history found for this store.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Last Order Snapshot
          <Badge variant="outline" className="text-xs ml-auto">Read-only · Derived</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ordered.map((snap) => {
          const brand = snap.canonical_brand_id
            ? getBrandIdentity(snap.canonical_brand_id)
            : null;
          const health = getHealthIndicator(snap);

          return (
            <div
              key={snap.brand_key}
              className={cn(
                'rounded-lg border p-3 space-y-2',
                brand ? `${brand.softBgClass} ${brand.borderClass}` : 'bg-muted/30 border-border/50'
              )}
            >
              {/* Brand header + health */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {brand && <span className="text-sm">{brand.icon}</span>}
                  <span className={cn('text-sm font-semibold', brand?.textClass)}>
                    {brand?.displayName || snap.brand_name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn('h-2 w-2 rounded-full', health.color)} />
                  <span className={cn('text-xs font-medium', health.textClass)}>{health.label}</span>
                </div>
              </div>

              {/* Metrics grid */}
              {snap.is_placeholder ? (
                <p className="text-xs text-muted-foreground italic">Never ordered</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Order</p>
                    <p className="text-sm font-medium">
                      {dynastyDate(snap.last_order_date)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{snap.days_since_last_order}d ago</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Size</p>
                    <p className="text-sm font-medium">{snap.last_order_size_label}</p>
                    {snap.last_order_total_amount != null && snap.last_order_total_amount > 0 && (
                      <p className="text-[10px] text-muted-foreground">${snap.last_order_total_amount}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cadence</p>
                    <p className="text-sm font-medium">
                      {snap.total_order_count >= 2
                        ? `${snap.avg_days_between_orders}d avg`
                        : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {snap.total_order_count} order{snap.total_order_count !== 1 ? 's' : ''} total
                    </p>
                  </div>
                </div>
              )}

              {/* Operational flags */}
              {(snap.is_restock_due || snap.is_order_smaller_than_usual) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {snap.is_restock_due && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-red-500/30 text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Restock Due
                    </Badge>
                  )}
                  {snap.is_order_smaller_than_usual && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                      <TrendingDown className="h-2.5 w-2.5" />
                      Smaller Than Usual
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
