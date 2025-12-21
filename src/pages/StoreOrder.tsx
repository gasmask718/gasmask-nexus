import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export default function StoreOrder() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");

  const { data: products } = useQuery({
    queryKey: ["products-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, brands(name, color)")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["my-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStore) throw new Error("Please select a store");
      if (cart.length === 0) throw new Error("Cart is empty");

      const orderNumber = `ORD-${Date.now()}`;
      const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
      const tax = subtotal * 0.08875; // NYC tax rate
      const deliveryFee = 10;
      const total = subtotal + tax + deliveryFee;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("store_orders")
        .insert({
          store_id: selectedStore,
          order_number: orderNumber,
          subtotal,
          tax,
          delivery_fee: deliveryFee,
          total_amount: total,
          payment_method: "invoice",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      const { error: itemsError } = await supabase
        .from("store_order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: (order) => {
      toast.success("Order placed successfully!", {
        description: `Order ${order.order_number} has been created`,
      });
      setCart([]);
      setSelectedStore("");
    },
    onError: (error: Error) => {
      toast.error("Failed to place order", { description: error.message });
    },
  });

  const addToCart = (product: any) => {
    const existingItem = cart.find((item) => item.product_id === product.id);
    
    if (existingItem) {
      setCart(cart.map((item) =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, total_price: (item.quantity + 1) * item.unit_price }
          : item
      ));
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.wholesale_price || 0,
          total_price: product.wholesale_price || 0,
        },
      ]);
    }
    
    toast.success(`Added ${product.name} to cart`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map((item) => {
      if (item.product_id === productId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return {
          ...item,
          quantity: newQuantity,
          total_price: newQuantity * item.unit_price,
        };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const tax = cartTotal * 0.08875;
  const deliveryFee = cart.length > 0 ? 10 : 0;
  const grandTotal = cartTotal + tax + deliveryFee;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Place Order</h1>
            <p className="text-muted-foreground">Browse products and order inventory</p>
          </div>
        </div>

        {/* Store Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Store</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="w-full p-2 border rounded-lg bg-background text-foreground"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            >
              <option value="" className="bg-background text-foreground">Choose a store...</option>
              {stores?.map((store) => (
                <option key={store.id} value={store.id} className="bg-background text-foreground">
                  {store.name} - {store.address_city}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Products */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Products Catalog</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {products?.map((product) => (
                    <Card key={product.id} className="border-2">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold">{product.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {product.brands?.name}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {product.type}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="text-xl font-bold">
                            ${product.wholesale_price}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addToCart(product)}
                            disabled={!selectedStore}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cart */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Shopping Cart ({cart.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Cart is empty
                  </p>
                ) : (
                  <>
                    <div className="space-y-3 mb-4">
                      {cart.map((item) => (
                        <div key={item.product_id} className="flex items-center gap-2 p-2 border rounded">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground">
                              ${item.unit_price} × {item.quantity}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.product_id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.product_id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => removeFromCart(item.product_id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="font-bold text-sm w-16 text-right">
                            ${item.total_price.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax (8.875%):</span>
                        <span>${tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Delivery Fee:</span>
                        <span>${deliveryFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>${grandTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full mt-4"
                      onClick={() => placeOrderMutation.mutate()}
                      disabled={!selectedStore || placeOrderMutation.isPending}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Place Order
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
