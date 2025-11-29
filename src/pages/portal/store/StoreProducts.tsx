import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts, useBrands } from "@/services/marketplace/useProducts";
import { usePricing } from "@/services/marketplace/usePricing";
import { useCart } from "@/services/marketplace/useCart";
import { Search, ShoppingCart, Package, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function StoreProducts() {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data: products, isLoading } = useProducts({ 
    search, 
    brandId: brandFilter !== "all" ? brandFilter : undefined 
  });
  const { data: brands } = useBrands();
  const { getProductPriceForDisplay } = usePricing();
  const { addToCart, isAddingToCart } = useCart();

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
              const storePrice = getProductPriceForDisplay(product, 'store');
              const retailPrice = getProductPriceForDisplay(product, 'retail');
              const savings = retailPrice > storePrice ? ((retailPrice - storePrice) / retailPrice * 100).toFixed(0) : 0;

              return (
                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-muted relative">
                    {product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
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
                      <h3 className="font-semibold line-clamp-2">{product.product_name}</h3>
                      {product.wholesaler && (
                        <p className="text-sm text-muted-foreground">
                          by {product.wholesaler.company_name}
                        </p>
                      )}
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

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>{product.inventory_qty || 0} in stock</span>
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
                        disabled={isAddingToCart || !product.inventory_qty}
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
