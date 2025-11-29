import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShoppingCart, Search, User, Package, Star, Filter } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string | null;
  suggested_retail_price: number | null;
  wholesale_price: number | null;
  store_price: number | null;
  is_active: boolean;
  sku: string | null;
}

export default function Shop() {
  const navigate = useNavigate();
  const { data: userData, isLoading: profileLoading } = useCurrentUserProfile();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);

  const isLoggedIn = !!userData?.profile;
  const isCustomer = userData?.profile?.primary_role === 'customer';

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, suggested_retail_price, wholesale_price, store_price, is_active, sku')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }

  const getDisplayPrice = (product: Product) => {
    // Retail customers see suggested_retail_price
    return product.suggested_retail_price || 0;
  };

  const addToCart = (productId: string) => {
    if (!isLoggedIn) {
      toast.info('Please sign in to add items to cart');
      navigate('/auth');
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item => 
          item.productId === productId 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
    toast.success('Added to cart');
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Shop</span>
            </div>

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
                  <Button variant="outline" size="sm" className="relative" onClick={() => toast.info('Cart coming soon')}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Cart
                    {cartCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                        {cartCount}
                      </Badge>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/portal/customer')}>
                    <User className="h-4 w-4 mr-2" />
                    My Account
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
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background py-12 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Premium Products, Direct to You</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Browse our curated selection of quality products with fast delivery and great prices.
          </p>
        </div>
      </div>

      {/* Categories */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Button variant="secondary" size="sm" className="shrink-0">
            <Filter className="h-4 w-4 mr-2" />
            All Products
          </Button>
          {categories.map(cat => (
            <Button key={cat} variant="outline" size="sm" className="shrink-0">
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-12">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-muted" />
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No products found</h3>
            <p className="text-muted-foreground">Try adjusting your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground/50" />
                </div>
                <CardContent className="p-4">
                  {product.category && (
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {product.category}
                    </Badge>
                  )}
                  <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">(4.8)</span>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-primary">
                    ${getDisplayPrice(product).toFixed(2)}
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button 
                    className="w-full" 
                    onClick={() => addToCart(product.id)}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
