import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Package, History, Sparkles, Store } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import PortalLayout from '@/components/portal/PortalLayout';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/services/marketplace/useCart';
import { Link } from 'react-router-dom';

const restockSuggestions = [
  { product: 'GasMask Tubes', reason: 'Running low based on your sales pattern', urgency: 'high' },
  { product: 'Hot Mama Boxes', reason: 'Predicted to run out in 5 days', urgency: 'medium' },
];

export default function StorePortal() {
  const { data: profileData } = useCurrentUserProfile();
  const storeProfile = profileData?.roleProfile as any;
  
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['store-portal-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, wholesale_price, suggested_retail_price, is_active, brand:brands(name, color)')
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const { addToCart, isAddingToCart, totals } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleAddToCart = async (productId: string) => {
    const qty = quantities[productId] || 1;
    try {
      await addToCart({ productId, qty, tier: 'store' });
    } catch (error) {
      // handled by hook
    }
  };

  return (
    <PortalLayout title="Store Portal">
      <div className="space-y-6">
        {/* Status Banner */}
        {storeProfile?.status === 'pending' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Your store account is pending verification. You'll be able to place orders once approved.
            </p>
          </div>
        )}

        {/* Store Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{storeProfile?.store_name || 'My Store'}</h2>
                <p className="text-muted-foreground">
                  {storeProfile?.city && `${storeProfile.city}, ${storeProfile.state || ''}`}
                </p>
                <Badge variant={storeProfile?.status === 'active' ? 'default' : 'secondary'}>
                  {storeProfile?.status || 'pending'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Restock Suggestions */}
        {restockSuggestions.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Restock Suggestions
              </CardTitle>
              <CardDescription>AI-powered recommendations based on your sales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {restockSuggestions.map((suggestion, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-background border">
                    <div>
                      <p className="font-medium">{suggestion.product}</p>
                      <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={suggestion.urgency === 'high' ? 'destructive' : 'secondary'}>
                        {suggestion.urgency}
                      </Badge>
                      <Button size="sm">Reorder</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wholesale Catalog */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Wholesale Catalog
                </CardTitle>
                <CardDescription>Browse products and place orders</CardDescription>
              </div>
              <div className="flex gap-2">
                <Link to="/portal/store/cart">
                  <Button variant="outline">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    View Cart ({totals.itemCount})
                  </Button>
                </Link>
                <Link to="/portal/store/products">
                  <Button variant="ghost" size="sm">See All</Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading products...</p>
            ) : !products?.length ? (
              <p className="text-center py-8 text-muted-foreground">No products available.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.slice(0, 8).map((product) => {
                  const price = product.wholesale_price || 0;
                  return (
                    <div key={product.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          {product.brand?.name && (
                            <p className="text-xs text-muted-foreground">{product.brand.name}</p>
                          )}
                          <p className="text-lg font-bold text-primary">{formatCurrency(price)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Input
                          type="number"
                          min="1"
                          value={quantities[product.id] || 1}
                          onChange={(e) => setQuantities(prev => ({ ...prev, [product.id]: parseInt(e.target.value) || 1 }))}
                          className="w-16"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(product.id)}
                          disabled={isAddingToCart || !product.inventory_qty}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order History - Link to full page */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              My Orders
            </CardTitle>
            <Link to="/portal/store/orders">
              <Button variant="ghost" size="sm">View All Orders</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <p className="text-center py-6 text-muted-foreground">
              <Link to="/portal/store/orders" className="text-primary hover:underline">
                View your order history →
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
