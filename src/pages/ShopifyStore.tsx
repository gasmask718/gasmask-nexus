import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useShopifyProducts, ShopifyProduct } from '@/hooks/useShopifyProducts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart, Search, Package, Star, Loader2, Sparkles, ExternalLink
} from 'lucide-react';

const SHOPIFY_STORE_URL = 'https://unforgettable-times-usa.myshopify.com';

export default function ShopifyStore() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: products, isLoading, error } = useShopifyProducts(100);

  const filtered = products?.filter((p) =>
    !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.productType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBuyNow = (product: ShopifyProduct) => {
    window.open(`${SHOPIFY_STORE_URL}/products/${product.handle}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/store" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                Unforgettable Times USA
              </span>
            </Link>

            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button variant="outline" size="sm" asChild>
              <a href={SHOPIFY_STORE_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Full Store
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 py-16 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4">🎉 Party Supplies & Event Rentals</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Make Every Event Unforgettable
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Browse our curated selection of party supplies, decorations, and event essentials — 
            powered live from our Shopify store.
          </p>
          {products && (
            <Badge className="mt-4 bg-green-500/90">{products.length} Products Live</Badge>
          )}
        </div>
      </div>

      {/* Products */}
      <div className="container mx-auto px-4 py-8 pb-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading products from Shopify...</span>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Could not load products</h3>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : !filtered || filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No products found</h3>
            <Button variant="outline" onClick={() => setSearchQuery('')}>Clear Search</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((product) => {
              const price = parseFloat(product.priceRange.minVariantPrice);
              const compareAt = product.variants[0]?.compareAtPrice
                ? parseFloat(product.variants[0].compareAtPrice)
                : null;
              const hasDiscount = compareAt && compareAt > price;

              return (
                <Card key={product.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-border/50">
                  <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden">
                    {product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].altText || product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-20 w-20 text-muted-foreground/30" />
                      </div>
                    )}
                    {hasDiscount && (
                      <Badge className="absolute top-3 left-3 bg-green-500">
                        {Math.round((1 - price / compareAt) * 100)}% OFF
                      </Badge>
                    )}
                    {!product.availableForSale && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Badge variant="destructive">Sold Out</Badge>
                      </div>
                    )}
                    {product.productType && (
                      <Badge variant="secondary" className="absolute top-3 right-3">
                        {product.productType}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors min-h-[2.5rem]">
                      {product.title}
                    </h3>
                    {product.vendor && (
                      <p className="text-xs text-muted-foreground mt-1">by {product.vendor}</p>
                    )}
                    <div className="flex items-center gap-1 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        ${price.toFixed(2)}
                      </span>
                      {hasDiscount && (
                        <span className="text-sm text-muted-foreground line-through">
                          ${compareAt.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {product.variants.length > 1 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {product.variants.length} variants available
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <Button
                      className="w-full"
                      onClick={() => handleBuyNow(product)}
                      disabled={!product.availableForSale}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Buy Now
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Unforgettable Times USA. All rights reserved.</p>
          <p className="mt-2">Products synced live from Shopify — new items appear automatically.</p>
        </div>
      </footer>
    </div>
  );
}
