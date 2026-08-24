import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Loader2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { DD_CATEGORY_OPTIONS } from '@/lib/dynastyDirect/categories';
import ProductJsonLd from '@/components/seo/ProductJsonLd';

const SITE = 'https://gasmask-os-nexus.lovable.app';

function categoryLabel(value: string | null | undefined) {
  if (!value) return null;
  return DD_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

/**
 * Public, crawlable product detail page for Dynasty Direct catalog products.
 * Reads the anon-safe `products_public` view and emits schema.org Product JSON-LD.
 */
export default function PublicProductPage() {
  const { productId } = useParams<{ productId: string }>();

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['public-product', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products_public')
        .select(
          'id, product_name, description, ai_description, ai_description_short, images, image_urls, primary_image_url, dtc_price_b, retail_price, inventory_qty, category, brand_id, unit_type, status',
        )
        .eq('id', productId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      let brandName: string | null = null;
      if (data.brand_id) {
        const { data: brand } = await supabase
          .from('brands')
          .select('name')
          .eq('id', data.brand_id)
          .maybeSingle();
        brandName = brand?.name ?? null;
      }
      return { ...data, brandName } as typeof data & { brandName: string | null };
    },
  });

  const price = product ? (product.dtc_price_b ?? product.retail_price ?? null) : null;
  const rawImages = [
    ...(Array.isArray(product?.images) ? (product!.images as string[]) : []),
    ...(Array.isArray(product?.image_urls) ? (product!.image_urls as string[]) : []),
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);
  const primary = product?.primary_image_url ?? null;
  const images = Array.from(new Set([...(primary ? [primary] : []), ...rawImages]));
  const productDescription =
    product?.ai_description ?? product?.description ?? product?.ai_description_short ?? null;

  useEffect(() => {
    if (!product) return;
    document.title = `${product.product_name} — Dynasty Direct`;
    const desc =
      product.ai_description_short ??
      productDescription ??
      `${product.product_name}${price != null ? ` — ${formatCurrency(price)}` : ''} from Dynasty Direct.`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc.slice(0, 155));
  }, [product, price, productDescription]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Product not found</h1>
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        <Button asChild variant="outline">
          <Link to="/shop">Back to shop</Link>
        </Button>
      </div>
    );
  }

  const inStock = product.inventory_qty === null || (product.inventory_qty ?? 0) > 0;

  return (
    <div className="container mx-auto px-4 py-10">
      <ProductJsonLd
        name={product.product_name}
        description={productDescription}
        images={images}
        price={price}
        inventoryQty={product.inventory_qty}
        brand={product.brandName}
        category={categoryLabel(product.category)}
        sku={product.id}
        url={`${SITE}/shop/product/${product.id}`}
      />

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardContent className="p-0 aspect-square flex items-center justify-center bg-muted rounded-lg overflow-hidden">
            {images[0] ? (
              <img
                src={images[0]}
                alt={product.product_name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-16 w-16 text-muted-foreground" />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold">{product.product_name}</h1>
          <div className="flex flex-wrap gap-2">
            {product.brandName && <Badge variant="outline">{product.brandName}</Badge>}
            {categoryLabel(product.category) && (
              <Badge variant="secondary">{categoryLabel(product.category)}</Badge>
            )}
            <Badge variant={inStock ? 'default' : 'destructive'}>
              {inStock ? 'In stock' : 'Out of stock'}
            </Badge>
          </div>
          {price != null && <p className="text-2xl font-semibold">{formatCurrency(price)}</p>}
          {productDescription && (
            <p className="text-muted-foreground whitespace-pre-line">{productDescription}</p>
          )}
          {product.unit_type && (
            <p className="text-sm text-muted-foreground">Sold per {product.unit_type}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!inStock || isAddingToCart}
              onClick={async () => {
                try {
                  await addToCart({ productId: product.id, qty: 1 });
                  toast.success('Added to cart');
                } catch (e: any) {
                  toast.error(e?.message ?? 'Could not add to cart');
                }
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {inStock ? 'Add to cart' : 'Out of stock'}
            </Button>
            <Button asChild variant="outline">
              <Link to="/cart">View cart</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/shop">Browse catalog</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
