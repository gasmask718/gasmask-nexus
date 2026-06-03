/**
 * BagsSection — Dedicated bag pipeline panel on the store profile.
 *
 * Intentionally rendered SEPARATELY from TubesSoldHeroStrip so that bag-tracked
 * inventory (track_by='bags' products) is not merged into tube counters.
 * Reads from bag_sale_ledger + bag_inventory_ledger.
 */
import { ShoppingBag, Calendar, Package, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useStoreBagSummary } from '@/hooks/useStoreBagSummary';
import { dynastyRelative } from '@/lib/dates';

interface Props { storeId: string }

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString();

export function BagsSection({ storeId }: Props) {
  const { data, isLoading, error } = useStoreBagSummary(storeId);

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="h-5 w-5 text-amber-500" />
            Bags Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-4 text-sm text-destructive">
          Failed to load bag pipeline: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  const s = data!;
  const hasActivity = s.lifetime_bags_sold > 0 || s.on_hand > 0;

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingBag className="h-5 w-5 text-amber-500" />
          Bags Pipeline
          <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wide">
            Separate from tubes
          </Badge>
        </CardTitle>
        {s.last_sale_at && (
          <span className="text-xs text-muted-foreground">
            last sale {dynastyRelative(s.last_sale_at)}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasActivity ? (
          <div className="text-sm text-muted-foreground py-3">
            No bag activity recorded yet for this store.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI icon={<ShoppingBag className="h-4 w-4" />} label="Lifetime bags sold" value={fmt(s.lifetime_bags_sold)} />
              <KPI icon={<Calendar className="h-4 w-4" />} label="Last 30 days" value={fmt(s.bags_last_30_days)} />
              <KPI icon={<Calendar className="h-4 w-4" />} label="This month" value={fmt(s.bags_this_month)} />
              <KPI icon={<Package className="h-4 w-4" />} label="On hand" value={fmt(s.on_hand)} />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Receipt className="h-3 w-3" />
              {fmt(s.invoice_count)} invoice{s.invoice_count === 1 ? '' : 's'} with bag lines
            </div>

            {s.by_product.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                {s.by_product.map((p) => (
                  <div
                    key={p.product_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ShoppingBag className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <span className="font-medium truncate">{p.product_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="font-mono">
                        sold {fmt(p.bags_sold)}
                      </Badge>
                      <Badge variant="secondary" className="font-mono">
                        30d {fmt(p.last_30)}
                      </Badge>
                      <Badge variant="default" className="font-mono">
                        on-hand {fmt(p.on_hand)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
