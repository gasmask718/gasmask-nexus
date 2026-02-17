import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/services/marketplace/useCart";
import { Search, ShoppingCart, Package, Filter } from "lucide-react";
import { Link } from "react-router-dom";

interface StoreProduct {
  id: string;
  name: string;
  type: string;
  unit_type: string;
  sku: string | null;
  category: string | null;
  wholesale_price: number;
  suggested_retail_price: number;
  is_active: boolean;
  status: string | null;
  brand: { name: string; color: string | null } | null;
}

function useStoreProducts(filters?: { search?: string; brandId?: string }) {
  return useQuery({
    queryKey: ['store-products', filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id, name, type, unit_type, sku, category,
          wholesale_price, suggested_retail_price,
          is_active, status,
          brand:brands(name, color)
        `)
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('name');

      if (filters?.brandId && filters.brandId !== 'all') {
        query = query.eq('brand_id', filters.brandId);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as StoreProduct[];
    },
  });
}

function useStoreBrands() {
  return useQuery({
    queryKey: ['store-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, color')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export default function StoreProducts() {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const { data: products, isLoading } = useStoreProducts({ 
    search, 
    brandId: brandFilter 
  });
  const { data: brands } = useStoreBrands();
  const { addToCart, isAddingToCart } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleAddToCart = async (productId: string) => {
    const qty = quantities[productId] || 1;
    try {
      await addToCart({ productId, qty, tier: 'store' });
    } catch (error) {
      // Error handled by hook
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Product Catalog</h1>
            <p className="text-muted-foreground">Browse wholesale products at store-tier pricing</p>
          </div>
          <Link to="/portal/store/cart">
            <Button variant="outline" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              View Cart
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by brand" />
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
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading products...</div>
        ) : products?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No products found. Try adjusting your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products?.map((product) => {
              const storePrice = product.wholesale_price || 0;
              const retailPrice = product.suggested_retail_price || 0;
              const savings = retailPrice > storePrice ? ((retailPrice - storePrice) / retailPrice * 100).toFixed(0) : 0;

              return (
                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-muted relative">
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                    {Number(savings) > 0 && (
                      <Badge className="absolute top-2 right-2 bg-green-500">
                        Save {savings}%
                      </Badge>
                    )}
                    {product.brand && (
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 left-2"
                        style={{ backgroundColor: product.brand.color || undefined }}
                      >
                        {product.brand.name}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold line-clamp-2">{product.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">
                        {product.brand?.name ? `${product.brand.name} · ` : ''}{product.category} · {product.unit_type}
                      </p>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(storePrice)}
                      </span>
                      {retailPrice > storePrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatCurrency(retailPrice)}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={quantities[product.id] || 1}
                        onChange={(e) => setQuantities(prev => ({
                          ...prev,
                          [product.id]: parseInt(e.target.value) || 1
                        }))}
                        className="w-20"
                      />
                      <Button
                        className="flex-1 gap-2"
                        onClick={() => handleAddToCart(product.id)}
                        disabled={isAddingToCart}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Add to Cart
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
