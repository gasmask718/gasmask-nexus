import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreInventoryBySku } from '@/hooks/useStoreInventoryBySku';
import { getSkuStatusIcon, getSkuStatusLabel } from '@/lib/inventory/skuDisplay';
import { getTubeBrandColor } from '@/constants/tubeColors';

interface StoreTubeIntelCardProps {
  storeId: string;
}

const BRAND_COLOR_KEY: Record<string, string> = {
  GasMask: 'gasmask',
  HotScalati: 'hotscolatti-light',
  'Hot Mama': 'hotmama',
  'Grabba R Us': 'grabba',
};

export function StoreTubeIntelCard({ storeId }: StoreTubeIntelCardProps) {
  const { data: skus, isLoading, refetch } = useStoreInventoryBySku(storeId);
  const totalTubes = skus?.reduce((sum, s) => sum + s.tubes_remaining, 0) ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4" />
          Tube Intel
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-medium">Total Tubes</span>
              <span className="text-lg font-bold text-primary">{totalTubes.toLocaleString()}</span>
            </div>

            <div className="space-y-1.5">
              {skus?.map((sku) => {
                const colorKey = BRAND_COLOR_KEY[sku.parent_brand] ?? 'gasmask';
                return (
                  <div
                    key={sku.product_id}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm leading-none" aria-hidden>
                        {getSkuStatusIcon(sku.status)}
                      </span>
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: getTubeBrandColor(colorKey).hex }}
                      />
                      <span className="text-sm truncate">{sku.display}</span>
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
                      className="font-mono text-xs"
                    >
                      {getSkuStatusLabel(sku.status, sku.tubes_remaining)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
