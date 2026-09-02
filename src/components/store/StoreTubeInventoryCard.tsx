import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTubeBrandColor } from '@/constants/tubeColors';
import { useStoreInventoryBySku } from '@/hooks/useStoreInventoryBySku';
import { getSkuStatusIcon, getSkuStatusLabel } from '@/lib/inventory/skuDisplay';
import { unitLabelForProductId } from '@/lib/inventory/unitLabel';

interface StoreTubeInventoryCardProps {
  storeId: string;
  onAddCount: () => void;
}

// Map parent brand → tube color key for the canonical color dot.
const BRAND_COLOR_KEY: Record<string, string> = {
  GasMask: 'gasmask',
  HotScalati: 'hotscolatti-light',
  'Hot Mama': 'hotmama',
  'Grabba R Us': 'grabba',
};

export function StoreTubeInventoryCard({ storeId, onAddCount }: StoreTubeInventoryCardProps) {
  const queryClient = useQueryClient();
  const { data: skus, isLoading, refetch } = useStoreInventoryBySku(storeId);

  // Realtime: invalidate the SKU rollup when any row for this store changes.
  useEffect(() => {
    const channel = supabase
      .channel(`store-tube-inventory-sku-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_tube_inventory_status',
          filter: `store_id=eq.${storeId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ['store-inventory-by-sku', storeId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [storeId, queryClient]);

  // Tubes and bags are DIFFERENT units — never summed under a "tubes" label.
  const tubesOnHand = skus
    ?.filter((s) => unitLabelForProductId(s.product_id) === 'tubes')
    .reduce((sum, s) => sum + s.tubes_remaining, 0) ?? 0;
  const bagsOnHand = skus
    ?.filter((s) => unitLabelForProductId(s.product_id) === 'bags')
    .reduce((sum, s) => sum + s.tubes_remaining, 0) ?? 0;
  const lastUpdated = skus
    ?.map((s) => s.last_updated)
    .filter((d): d is string => !!d)
    .sort()
    .reverse()[0] ?? null;

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-primary" />
          Tube Inventory
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={onAddCount} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add Count
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Unit-separated totals across the canonical SKUs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <span className="font-medium">Tubes On Hand</span>
                <span className="text-2xl font-bold text-primary">{tubesOnHand.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="font-medium">Bags On Hand</span>
                <span className="text-2xl font-bold text-amber-600">{bagsOnHand.toLocaleString()}</span>
              </div>
            </div>

            {/* All 9 canonical SKUs (always rendered, status icon shows pitch state) */}
            <div className="space-y-2">
              {skus?.map((sku) => {
                const colorKey = BRAND_COLOR_KEY[sku.parent_brand] ?? 'gasmask';
                return (
                  <div
                    key={sku.product_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base leading-none" aria-hidden>
                        {getSkuStatusIcon(sku.status)}
                      </span>
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getTubeBrandColor(colorKey).hex }}
                      />
                      <span className="font-medium truncate">{sku.display}</span>
                      {sku.needs_operator_verification && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 text-[10px] px-1.5 py-0"
                          title="Backfilled from ambiguous brand data — please verify the correct SKU during your next Tube Intelligence update."
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Verify SKU
                        </Badge>
                      )}
                    </div>
                    <Badge
                      variant={
                        sku.status === 'never_offered'
                          ? 'destructive'
                          : sku.tubes_remaining < 20
                            ? 'destructive'
                            : sku.tubes_remaining < 50
                              ? 'secondary'
                              : 'default'
                      }
                      className="font-mono text-sm"
                    >
                      {getSkuStatusLabel(sku.status, sku.tubes_remaining, unitLabelForProductId(sku.product_id))}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <Clock className="h-3 w-3" />
                <span>
                  Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
