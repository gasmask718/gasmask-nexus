import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Package, Clock, DollarSign, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function WholesaleMarketplace() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCart, setShowCart] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["wholesale-products", categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("wholesale_products")
        .select("*, wholesale_hubs(name, address_city), brands(name, color)")
        .eq("is_active", true)
        .order("category")
        .order("name");

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredProducts = products?.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (productId: string) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
    toast({
      title: "Added to cart",
      description: "Product added successfully",
    });
  };

  const cartItems = products?.filter((p) => cart[p.id]) || [];
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * cart[item.id],
    0
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-muted-foreground">Loading marketplace...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Wholesale Marketplace</h1>
            <p className="text-muted-foreground">
              Order from verified wholesale partners
            </p>
          </div>
          <Button
            onClick={() => setShowCart(true)}
            className="relative"
            variant="default"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart {Object.keys(cart).length > 0 && `(${Object.keys(cart).length})`}
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="blends">Blends</SelectItem>
                <SelectItem value="tubes">Tubes</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
                <SelectItem value="papers">Papers</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts?.map((product) => (
            <Card key={product.id} className="p-4 space-y-3">
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Package className="h-12 w-12 text-muted-foreground" />
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                  {product.brands && (
                    <Badge
                      variant="outline"
                      style={{ borderColor: product.brands.color || undefined }}
                    >
                      {product.brands.name}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>Case of {product.case_size}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{product.eta_delivery_days} days delivery</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1 font-semibold text-lg">
                    <DollarSign className="h-5 w-5" />
                    {product.price.toFixed(2)}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addToCart(product.id)}
                    disabled={product.stock === 0}
                  >
                    {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  From: {product.wholesale_hubs?.name}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredProducts?.length === 0 && (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </Card>
        )}
      </div>

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shopping Cart</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-semibold">{item.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    ${item.price.toFixed(2)} x {cart[item.id]}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="1"
                    value={cart[item.id]}
                    onChange={(e) =>
                      setCart((prev) => ({
                        ...prev,
                        [item.id]: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="w-20"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newCart = { ...cart };
                      delete newCart[item.id];
                      setCart(newCart);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            {cartItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Your cart is empty
              </div>
            )}

            {cartItems.length > 0 && (
              <>
                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="font-semibold">Total:</span>
                  <span className="text-2xl font-bold">
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>
                <Button className="w-full" size="lg">
                  Proceed to Checkout
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}