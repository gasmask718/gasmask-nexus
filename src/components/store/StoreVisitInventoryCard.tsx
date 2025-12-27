import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Boxes, RefreshCw, Calendar } from 'lucide-react';
import { useStoreVisitInventory } from '@/hooks/useVisitProducts';
import { formatDistanceToNow } from 'date-fns';

interface StoreVisitInventoryCardProps {
  storeId: string;
}

export function StoreVisitInventoryCard({ storeId }: StoreVisitInventoryCardProps) {
  const { data: inventory, isLoading, refetch } = useStoreVisitInventory(storeId);

  const getBrandColor = (brandName: string) => {
    const colors: Record<string, string> = {
      'GasMask': '#FF0000',
      'HotMama': '#FF4F9D',
      'Hot Scalati': '#FF7A00',
      'Hot Scolatti': '#FF7A00',
      'Grabba R Us': '#A020F0',
    };
    return colors[brandName] || '#6366F1';
  };

  const totalProducts = inventory?.reduce((sum, item) => sum + item.total_quantity, 0) || 0;

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Boxes className="h-5 w-5 text-primary" />
          Product Inventory
          <Badge variant="outline" className="ml-2">From Visits</Badge>
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inventory && inventory.length > 0 ? (
          <>
            {/* Total summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="font-medium">Total Products Delivered</span>
              <span className="text-2xl font-bold text-primary">{totalProducts.toLocaleString()} units</span>
            </div>

            {/* Product breakdown */}
            <div className="space-y-2">
              {inventory.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: getBrandColor(item.brand_name) }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.brand_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant={item.total_quantity < 20 ? 'destructive' : item.total_quantity < 50 ? 'secondary' : 'default'}
                      className="font-mono text-sm"
                    >
                      {item.total_quantity} units
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(item.last_visit_date), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Boxes className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No products delivered yet</p>
            <p className="text-xs mt-1">Products will appear here after visits</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}