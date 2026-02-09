import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, TrendingDown } from 'lucide-react';
import { useLastOrderSnapshot } from '@/hooks/useLastOrderSnapshot';
import { getBrandIdentity, CANONICAL_BRAND_IDS } from '@/config/brands';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LastOrderContextSectionProps {
  storeId: string;
}

export function LastOrderContextSection({ storeId }: LastOrderContextSectionProps) {
  const { data: snapshots, isLoading } = useLastOrderSnapshot(storeId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Deduplicate by canonical brand, prefer most recent
  const brandMap = new Map<string, (typeof snapshots extends (infer T)[] | undefined ? T : never)>();
  for (const snap of (snapshots || [])) {
    const key = snap.canonical_brand_id || snap.brand_key;
    const existing = brandMap.get(key);
    if (!existing || new Date(snap.last_order_date) > new Date(existing.last_order_date)) {
      brandMap.set(key, snap);
    }
  }

  // Order: canonical brands first
  const ordered: NonNullable<typeof snapshots> = [];
  for (const brandId of CANONICAL_BRAND_IDS) {
    if (brandMap.has(brandId)) {
      ordered.push(brandMap.get(brandId)!);
      brandMap.delete(brandId);
    }
  }
  for (const snap of brandMap.values()) ordered.push(snap);

  const getHealthBadge = (snap: (typeof ordered)[number]) => {
    if (snap.total_order_count < 2 || snap.avg_days_between_orders <= 0) {
      return <Badge variant="outline" className="text-xs">New</Badge>;
    }
    const ratio = snap.days_since_last_order / snap.avg_days_between_orders;
    if (ratio <= 1) return <Badge className="bg-emerald-500/20 text-emerald-600 text-xs">On Track</Badge>;
    if (ratio <= 1.5) return <Badge className="bg-amber-500/20 text-amber-600 text-xs">Late</Badge>;
    return <Badge className="bg-red-500/20 text-red-600 text-xs">Overdue</Badge>;
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm">Last Order Context</h4>
          <Badge variant="outline" className="text-xs">Read-only</Badge>
        </div>
        {ordered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No order history</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {ordered.map((snap) => {
              const brand = snap.canonical_brand_id
                ? getBrandIdentity(snap.canonical_brand_id)
                : null;
              return (
                <div key={snap.brand_key} className={cn('p-2 rounded-lg', brand?.softBgClass || 'bg-muted/30')}>
                  <div className="flex items-center gap-1 mb-1">
                    {brand && <span className="text-xs">{brand.icon}</span>}
                    <span className={cn('text-xs font-medium', brand?.textClass)}>
                      {brand?.shortName || brand?.displayName || snap.brand_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {snap.days_since_last_order}d ago · {snap.last_order_size_label}
                    </span>
                    {getHealthBadge(snap)}
                  </div>
                  {(snap.is_restock_due || snap.is_order_smaller_than_usual) && (
                    <div className="flex gap-1 mt-1">
                      {snap.is_restock_due && (
                        <Badge variant="outline" className="text-[9px] gap-0.5 border-red-500/30 text-red-600">
                          <AlertTriangle className="h-2 w-2" />
                          Restock
                        </Badge>
                      )}
                      {snap.is_order_smaller_than_usual && (
                        <Badge variant="outline" className="text-[9px] gap-0.5 border-amber-500/30 text-amber-600">
                          <TrendingDown className="h-2 w-2" />
                          Smaller
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
