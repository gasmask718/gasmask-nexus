import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProducts, useBrands, MarketplaceProduct } from '@/services/marketplace/useProducts';
import { useCart } from '@/services/marketplace/useCart';
import { usePricing } from '@/services/marketplace/usePricing';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  ShoppingCart, Search, User, Package, Star, Filter, 
  Loader2, ArrowRight, Sparkles 
} from 'lucide-react';

export default function Shop() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  const { data: products, isLoading: productsLoading } = useProducts({
    brandId: selectedBrand !== 'all' ? selectedBrand : undefined,
    search: searchQuery || undefined,
  });
  const { data: brands } = useBrands();
  const { addToCart, isAddingToCart, totals } = useCart();
  const { detectTierForUser, getProductPriceForDisplay } = usePricing();

  const tier = detectTierForUser();
  const isLoggedIn = !!user;

  const handleAddToCart = async (product: MarketplaceProduct) => {
    if (!isLoggedIn) {
      toast.info('Please sign in to add items to cart');
      navigate('/auth');
      return;
    }

    try {
      await addToCart({ productId: product.id, qty: 1, tier });
    } catch (error) {
      console.error('Add to cart error:', error);
    }
  };

  const getPrice = (product: MarketplaceProduct) => {
    return getProductPriceForDisplay({
      retail_price: product.retail_price,
      store_price: product.store_price,
      wholesale_price: product.wholesale_price,
    }, tier);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/shop" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                DynastyOS Shop
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

            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <>
                  <Badge variant="outline" className="hidden sm:flex">
                    {tier.charAt(0).toUpperCase() + tier.slice(1)} Pricing
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="relative"
                    onClick={() => navigate('/cart')}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Cart
                    {totals.itemCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                        {totals.itemCount}
                      </Badge>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/portal/customer')}>
                    <User className="h-4 w-4 mr-2" />
                    Account
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
                    Sign In
                  </Button>
                  <Button size="sm" onClick={() => navigate('/portal/register')}>
                    Create Account
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-blue-500/10 to-purple-500/10 py-16 px-4">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto text-center relative">
          <Badge variant="secondary" className="mb-4">Multi-Tier Marketplace</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Premium Products, Direct to You
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
            Browse our curated selection from verified wholesalers. 
            {tier === 'store' && ' Store pricing unlocked!'}
            {tier === 'wholesale' && ' Wholesale pricing unlocked!'}
          </p>
          {!isLoggedIn && (
            <Button onClick={() => navigate('/auth')} size="lg">
              Sign in for Better Prices
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by:</span>
          </div>
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands?.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-destructive">×</button>
            </Badge>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-12">
        {productsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
            <Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedBrand('all'); }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const price = getPrice(product);
              const retailPrice = Number(product.retail_price) || 0;
              const hasDiscount = tier !== 'retail' && price < retailPrice;

              return (
                <Card key={product.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-border/50">
                  {/* Product Image */}
                  <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.product_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-20 w-20 text-muted-foreground/30" />
                      </div>
                    )}
                    {hasDiscount && (
                      <Badge className="absolute top-3 left-3 bg-green-500">
                        {Math.round((1 - price / retailPrice) * 100)}% OFF
                      </Badge>
                    )}
                    {product.brand && (
                      <Badge 
                        variant="secondary" 
                        className="absolute top-3 right-3"
                        style={{ backgroundColor: product.brand.color || undefined }}
                      >
                        {product.brand.name}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors min-h-[2.5rem]">
                      {product.product_name}
                    </h3>
                    
                    {product.wholesaler && (
                      <p className="text-xs text-muted-foreground mt-1">
                        by {product.wholesaler.company_name}
                      </p>
                    )}

                    <div className="flex items-center gap-1 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">(4.8)</span>
                    </div>

                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        ${price.toFixed(2)}
                      </span>
                      {hasDiscount && (
                        <span className="text-sm text-muted-foreground line-through">
                          ${retailPrice.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {product.inventory_qty !== null && product.inventory_qty < 10 && product.inventory_qty > 0 && (
                      <p className="text-xs text-amber-600 mt-1">Only {product.inventory_qty} left!</p>
                    )}
                    {product.inventory_qty === 0 && (
                      <p className="text-xs text-destructive mt-1">Out of stock</p>
                    )}
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <Button 
                      className="w-full" 
                      onClick={() => handleAddToCart(product)}
                      disabled={isAddingToCart || product.inventory_qty === 0}
                    >
                      {isAddingToCart ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4 mr-2" />
                      )}
                      Add to Cart
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
          <p>© 2024 DynastyOS Marketplace. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Link to="/shop" className="hover:text-foreground">Shop</Link>
            <Link to="/portal/customer" className="hover:text-foreground">My Account</Link>
            <Link to="/cart" className="hover:text-foreground">Cart</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
