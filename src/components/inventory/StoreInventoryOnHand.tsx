import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface InventoryRow {
  store_id: string;
  product_id: string;
  product_name: string;
  brand_id: string | null;
  count: number;
}

const viewByType = {
  tubes: 'v_store_tubes_on_hand',
  bags: 'v_store_bags_on_hand',
} as const;

const countColByType = {
  tubes: 'tubes_on_hand',
  bags: 'bags_on_hand',
} as const;

function useStoreInventoryOnHand(type: 'tubes' | 'bags') {
  const view = viewByType[type];
  const countCol = countColByType[type];

  return useQuery({
    queryKey: ['store-inventory-on-hand', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(view as any)
        .select('store_id, product_id, product_name, brand_id, ' + countCol)
        .order('store_id');
      if (error) throw error;
      return (data || []).map((r: any) => ({
        store_id: r.store_id,
        product_id: r.product_id,
        product_name: r.product_name || 'Unknown',
        brand_id: r.brand_id,
        count: r[countCol] ?? 0,
      })) as InventoryRow[];
    },
  });
}

export function StoreInventoryOnHand({ type }: { type: 'tubes' | 'bags' }) {
  const { data, isLoading } = useStoreInventoryOnHand(type);
  const Icon = type === 'tubes' ? Package : ShoppingBag;
  const label = type === 'tubes' ? 'Tubes' : 'Bags';

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent>
      </Card>
    );
  }

  const totalCount = data?.reduce((s, r) => s + r.count, 0) ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-primary" />
          {label} On Hand
          <Badge variant="outline" className="ml-auto font-mono">
            {totalCount.toLocaleString()} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data.map((row) => (
              <div key={`${row.store_id}-${row.product_id}`} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <span className="font-medium text-sm truncate">{row.product_name}</span>
                <Badge variant={row.count <= 0 ? 'destructive' : row.count < 20 ? 'secondary' : 'default'} className="font-mono">
                  {row.count} {label.toLowerCase()}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No {label.toLowerCase()} ledger data yet</p>
        )}
      </CardContent>
    </Card>
  );
}
