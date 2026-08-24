import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Search, Loader2, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useDynastyDirectProducts } from '@/services/marketplace/useDynastyDirectProducts';
import { useCart } from '@/services/marketplace/useCart';
import { DD_CATEGORY_OPTIONS } from '@/lib/dynastyDirect/categories';
import { toast } from 'sonner';

/**
 * Dynasty Direct D2C storefront — the public catalogue grid.
 * Reads the anon-safe `products_public` view; add-to-cart routes into the
 * existing cart/checkout pipeline.
 */
export default function Shop() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const { data: products = [], isLoading, error } = useDynastyDirectProducts({ search: search || undefined });
  const { addToCart, isAddingToCart } = useCart();

  useEffect(() => {
    document.title = 'Shop — Dynasty Direct';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Shop the Dynasty Direct catalogue — wholesale-sourced products shipped direct, with live carrier rates at checkout.',
    );
  }, []);

  const visible = useMemo(
    () => (category === 'all' ? products : products.filter((p: any) => p.category === category)),
    [products, category],
  );

  const categoriesPresent = useMemo(() => {
    const set = new Set(products.map((p: any) => p.category).filter(Boolean));
    return DD_CATEGORY_OPTIONS.filter((c) => set.has(c.value));
  }, [products]);

  async function handleAdd(productId: string, name: string) {
    try {
      await addToCart({ productId, qty: 1 });
      toast.success(`${name} added to cart`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not add to cart');
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Dynasty Direct</h1>
        <p className="text-muted-foreground">
          Shipped direct from our supplier network. Live carrier rates calculated at checkout.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search products"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={category === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCategory('all')}>
            All
          </Button>
          {categoriesPresent.map((c) => (
            <Button
              key={c.value}
              variant={category === c.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{(error as Error).message}</p>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Package className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Nothing live in this catalogue yet</p>
            <p className="text-sm text-muted-foreground">
              Products appear here once they pass the admin review gate.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p: any) => {
            const img = p.primary_image_url ?? (Array.isArray(p.images) ? p.images[0] : null);
            const price = p.retail_price ?? null;
            const inStock = p.inventory_qty === null || (p.inventory_qty ?? 0) > 0;
            return (
              <Card key={p.id} className="overflow-hidden flex flex-col">
                <Link to={`/shop/product/${p.id}`} className="block aspect-square bg-muted">
                  {img ? (
                    <img
                      src={img}
                      alt={p.product_name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </Link>
                <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                  <Link to={`/shop/product/${p.id}`} className="font-medium hover:underline line-clamp-2">
                    {p.product_name}
                  </Link>
                  {p.brand?.name && <Badge variant="outline" className="w-fit">{p.brand.name}</Badge>}
                  <div className="mt-auto space-y-2 pt-2">
                    {price != null && <p className="text-lg font-semibold">{formatCurrency(price)}</p>}
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={!inStock || isAddingToCart}
                      onClick={() => handleAdd(p.id, p.product_name)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {inStock ? 'Add to cart' : 'Out of stock'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
