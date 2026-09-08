import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
      <header className="border-b border-[hsl(var(--dd-line))] pb-6">
        <h1 className="font-display text-3xl">The catalog</h1>
        <p className="mt-2 text-[hsl(var(--dd-ink))]/70 max-w-xl">
          Sourced from vetted suppliers and shipped direct. Shipping is quoted live by the carrier
          at checkout from the real measured box.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--dd-ink))]/45" />
          <Input
            className="pl-9 bg-white border-[hsl(var(--dd-line))] rounded-none"
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search products"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={category === 'all' ? 'default' : 'outline'}
            size="sm"
            className="rounded-none"
            onClick={() => setCategory('all')}
          >
            All
          </Button>
          {categoriesPresent.map((c) => (
            <Button
              key={c.value}
              variant={category === c.value ? 'default' : 'outline'}
              size="sm"
              className="rounded-none"
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--dd-navy))]" />
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{(error as Error).message}</p>
      ) : visible.length === 0 ? (
        <div className="dd-panel p-12 text-center space-y-2">
          <Package className="h-10 w-10 mx-auto text-[hsl(var(--dd-ink))]/30" />
          <p className="font-medium">Nothing live in this catalog yet</p>
          <p className="text-sm text-[hsl(var(--dd-ink))]/60">
            Products appear here once they pass verification.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p: any) => {
            const img = p.primary_image_url ?? (Array.isArray(p.images) ? p.images[0] : null);
            {/* retail_price is remapped to dtc_price_b by useDynastyDirectProducts */}
            const price = p.retail_price ?? null;
            const inStock = p.inventory_qty === null || (p.inventory_qty ?? 0) > 0;
            return (
              <div key={p.id} className="bg-white border border-[hsl(var(--dd-line))] flex flex-col">
                <Link to={`/shop/product/${p.id}`} className="block aspect-square bg-[hsl(var(--dd-paper))]">
                  {img ? (
                    <img
                      src={img}
                      alt={p.product_name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-10 w-10 text-[hsl(var(--dd-ink))]/25" />
                    </div>
                  )}
                </Link>
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <Link to={`/shop/product/${p.id}`} className="font-medium hover:text-[hsl(var(--dd-navy))] line-clamp-2">
                    {p.product_name}
                  </Link>
                  {p.brand?.name && (
                    <Badge variant="outline" className="w-fit rounded-none">{p.brand.name}</Badge>
                  )}
                  <div className="mt-auto space-y-3 pt-2">
                    {price != null && (
                      <p className="dd-num text-lg font-semibold text-[hsl(var(--dd-gold))]">
                        {formatCurrency(price)}
                      </p>
                    )}
                    <Button
                      className="w-full rounded-none"
                      size="sm"
                      disabled={!inStock || isAddingToCart}
                      onClick={() => handleAdd(p.id, p.product_name)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {inStock ? 'Add to cart' : 'Out of stock'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

