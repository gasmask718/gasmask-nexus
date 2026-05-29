import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

interface ProductCatalogCardProps {
  storeId?: string;
}

const BRAND_COLORS: Record<string, string> = {
  'fb52b0e6-39b2-4e13-bea9-cd016f51efb0': 'border-red-500/40 bg-red-500/5',       // GasMask
  '4b1c1255-b7b1-43ea-9ad9-a257c6582094': 'border-purple-500/40 bg-purple-500/5',  // Grabba R Us
  'f3e8ba65-2b76-4f61-a157-0751acb3e7b2': 'border-pink-500/40 bg-pink-500/5',      // Hot Mama
  'c9d60b82-f0d3-44b4-9b33-1abe4adf1ebe': 'border-orange-500/40 bg-orange-500/5',  // HotScalati
};

export function ProductCatalogCard({ storeId }: ProductCatalogCardProps) {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['product-catalog', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, store_price, wholesale_price, brand_id, category, hero_score, description, type')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .is('deleted_at', null)
        .order('hero_score', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['product-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, color')
        .in('id', [
          'fb52b0e6-39b2-4e13-bea9-cd016f51efb0',
          '4b1c1255-b7b1-43ea-9ad9-a257c6582094',
          'f3e8ba65-2b76-4f61-a157-0751acb3e7b2',
          'c9d60b82-f0d3-44b4-9b33-1abe4adf1ebe',
        ]);
      if (error) throw error;
      return data || [];
    },
  });

  const getBrandName = (brandId: string | null) => {
    if (!brandId) return 'Unknown';
    return brands.find(b => b.id === brandId)?.name || 'Unknown';
  };

  const isNewProduct = (product: any) => {
    return (product.hero_score ?? 0) >= 80;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-primary" />
          Product Catalog
          <Badge variant="outline" className="text-xs ml-auto">
            {products.length} products
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((product) => {
            const brandName = getBrandName(product.brand_id);
            const isNew = isNewProduct(product);
            const brandColorClass = product.brand_id
              ? BRAND_COLORS[product.brand_id] || 'border-border bg-muted/30'
              : 'border-border bg-muted/30';

            return (
              <div
                key={product.id}
                className={cn(
                  'relative rounded-lg border-2 p-3 transition-colors hover:shadow-sm',
                  brandColorClass,
                  isNew && 'ring-1 ring-sky-500/30'
                )}
              >
                {/* New/Featured badge */}
                {isNew && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-sky-500 text-white text-[10px] gap-0.5 px-1.5 py-0.5">
                      <Sparkles className="h-3 w-3" />
                      New
                    </Badge>
                  </div>
                )}

                {/* Product name — store price */}
                <p className="font-semibold text-sm leading-tight pr-8">
                  {product.name} — {formatCurrency(product.store_price)}
                </p>

                {/* Brand · SKU */}
                <p className="text-xs text-muted-foreground mt-1">
                  {brandName} · {product.sku || '—'}
                </p>

                {/* Price row */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-base font-bold">
                    {formatCurrency(product.store_price)}
                  </span>
                  {product.wholesale_price && (
                    <span className="text-xs text-muted-foreground">
                      Wholesale: {formatCurrency(product.wholesale_price)}
                    </span>
                  )}
                </div>

                {/* Category tag */}
                {product.category && (
                  <Badge variant="secondary" className="text-[10px] mt-2 capitalize">
                    {product.category}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
