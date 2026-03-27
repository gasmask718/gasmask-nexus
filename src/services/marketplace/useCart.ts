import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PricingTier, usePricing } from "./usePricing";

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  qty: number;
  price_locked: number | null;
  product?: {
    id: string;
    product_name: string;
    images: string[];
    retail_price: number | null;
    store_price: number | null;
    wholesale_price: number | null;
    wholesaler_id: string | null;
    inventory_qty: number | null;
    weight_oz: number | null;
  };
}

export interface CartTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
}

export function useCart() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { detectTierForUser, getProductPriceForDisplay } = usePricing();

  // Get or create cart
  const getOrCreateCart = async (): Promise<string> => {
    if (!user) throw new Error('Must be logged in');

    const { data: existingCart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (existingCart) return existingCart.id;

    const { data: newCart, error } = await supabase
      .from('carts')
      .insert({ user_id: user.id, status: 'active' })
      .select('id')
      .single();

    if (error) throw error;
    return newCart.id;
  };

  // Fetch cart items
  const cartQuery = useQuery({
    queryKey: ['cart', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: cart } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!cart) return [];

      const { data: items, error } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', cart.id);

      if (error) throw error;
      if (!items || items.length === 0) return [];

      const productIds = items.map(i => i.product_id).filter(Boolean) as string[];

      // Try products_all first
      const { data: productsAll } = await supabase
        .from('products_all')
        .select('id, product_name, images, retail_price, store_price, wholesale_price, wholesaler_id, inventory_qty, weight_oz')
        .in('id', productIds);

      // Also try products table for store products
      const { data: productsLocal } = await supabase
        .from('products')
        .select('id, name, image_url, wholesale_price, suggested_retail_price, store_price, weight_per_unit')
        .in('id', productIds);

      const productMap: Record<string, CartItem['product']> = {};
      (productsAll || []).forEach(p => {
        productMap[p.id] = {
          id: p.id,
          product_name: p.product_name || '',
          images: Array.isArray(p.images) ? p.images : [],
          retail_price: p.retail_price,
          store_price: p.store_price,
          wholesale_price: p.wholesale_price,
          wholesaler_id: p.wholesaler_id,
          inventory_qty: p.inventory_qty,
          weight_oz: p.weight_oz,
        };
      });
      (productsLocal || []).forEach(p => {
        if (!productMap[p.id]) {
          productMap[p.id] = {
            id: p.id,
            product_name: p.name || '',
            images: p.image_url ? [p.image_url] : [],
            retail_price: p.suggested_retail_price,
            store_price: p.store_price,
            wholesale_price: p.wholesale_price,
            wholesaler_id: null,
            inventory_qty: null,
            weight_oz: p.weight_per_unit,
          };
        }
      });

      return items.map(item => ({
        ...item,
        qty: item.qty || 1,
        product: item.product_id ? productMap[item.product_id] : undefined,
      })) as CartItem[];
    },
    enabled: !!user,
  });

  // Add to cart
  const addToCartMutation = useMutation({
    mutationFn: async ({ 
      productId, 
      qty, 
      tier 
    }: { 
      productId: string; 
      qty: number; 
      tier?: PricingTier 
    }) => {
      const cartId = await getOrCreateCart();
      const effectiveTier = tier || detectTierForUser();

      // Get product price
      const { data: product } = await supabase
        .from('products_all')
        .select('retail_price, store_price, wholesale_price')
        .eq('id', productId)
        .single();

      if (!product) throw new Error('Product not found');

      const price = getProductPriceForDisplay(product, effectiveTier);

      // Check if item already in cart
      const { data: existingItem } = await supabase
        .from('cart_items')
        .select('id, qty')
        .eq('cart_id', cartId)
        .eq('product_id', productId)
        .single();

      if (existingItem) {
        // Update quantity
        const { error } = await supabase
          .from('cart_items')
          .update({ qty: existingItem.qty + qty, price_locked: price })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        // Insert new item
        const { error } = await supabase
          .from('cart_items')
          .insert({
            cart_id: cartId,
            product_id: productId,
            qty,
            price_locked: price,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Added to cart');
    },
    onError: (error) => {
      toast.error(`Failed to add to cart: ${error.message}`);
    },
  });

  // Remove from cart
  const removeFromCartMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Removed from cart');
    },
  });

  // Update quantity
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, qty }: { itemId: string; qty: number }) => {
      if (qty <= 0) {
        return removeFromCartMutation.mutateAsync(itemId);
      }

      const { error } = await supabase
        .from('cart_items')
        .update({ qty })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  // Clear cart
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { data: cart } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (cart) {
        await supabase.from('cart_items').delete().eq('cart_id', cart.id);
        await supabase.from('carts').update({ status: 'converted' }).eq('id', cart.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  // Calculate totals
  const calculateTotals = (items: CartItem[]): CartTotals => {
    const tier = detectTierForUser();
    
    const subtotal = items.reduce((sum, item) => {
      const price = item.price_locked || 
        (item.product ? getProductPriceForDisplay(item.product, tier) : 0);
      return sum + (price * item.qty);
    }, 0);

    const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
    
    // Estimate shipping based on weight
    const totalWeight = items.reduce((sum, item) => {
      const weight = item.product?.weight_oz || 0;
      return sum + (weight * item.qty);
    }, 0);
    const shipping = totalWeight > 0 ? Math.max(5.99, totalWeight * 0.15) : 0;
    
    const tax = subtotal * 0.08; // 8% estimated tax
    const total = subtotal + shipping + tax;

    return { subtotal, shipping, tax, total, itemCount };
  };

  return {
    items: cartQuery.data || [],
    isLoading: cartQuery.isLoading,
    totals: calculateTotals(cartQuery.data || []),
    addToCart: addToCartMutation.mutateAsync,
    removeFromCart: removeFromCartMutation.mutateAsync,
    updateQuantity: updateQuantityMutation.mutateAsync,
    clearCart: clearCartMutation.mutateAsync,
    isAddingToCart: addToCartMutation.isPending,
  };
}
