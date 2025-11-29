import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CartItem, CartTotals } from "./useCart";

export interface ShippingAddress {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
}

export interface CheckoutData {
  items: CartItem[];
  totals: CartTotals;
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  deliveryType: 'ship' | 'pickup' | 'delivery';
  paymentMethod: 'card' | 'cash' | 'net_terms';
  notes?: string;
}

interface OrderResult {
  orderId: string;
  orderNumber: string;
}

export function useCheckout() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();

  // Group items by wholesaler
  const groupItemsByWholesaler = (items: CartItem[]) => {
    const groups = new Map<string, CartItem[]>();
    
    items.forEach(item => {
      const wholesalerId = item.product?.wholesaler_id || 'unknown';
      const existing = groups.get(wholesalerId) || [];
      groups.set(wholesalerId, [...existing, item]);
    });

    return groups;
  };

  // Validate checkout data
  const validateCheckout = (data: CheckoutData): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (data.items.length === 0) {
      errors.push('Cart is empty');
    }

    if (!data.shippingAddress.fullName) {
      errors.push('Full name is required');
    }

    if (!data.shippingAddress.street) {
      errors.push('Street address is required');
    }

    if (!data.shippingAddress.city || !data.shippingAddress.state) {
      errors.push('City and state are required');
    }

    if (!data.shippingAddress.zipCode) {
      errors.push('ZIP code is required');
    }

    // Check stock availability
    for (const item of data.items) {
      if (item.product && item.product.inventory_qty !== null) {
        if (item.qty > item.product.inventory_qty) {
          errors.push(`${item.product.product_name} only has ${item.product.inventory_qty} in stock`);
        }
      }
    }

    // Cash/Net terms only for stores
    if (data.paymentMethod !== 'card' && userRole !== 'store' && userRole !== 'store_owner') {
      errors.push('Cash and net terms are only available for store accounts');
    }

    return { valid: errors.length === 0, errors };
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutData): Promise<OrderResult> => {
      if (!user) throw new Error('Must be logged in to checkout');

      const validation = validateCheckout(data);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Group items by wholesaler for order routing
      const wholesalerGroups = groupItemsByWholesaler(data.items);
      const firstWholesalerId = data.items[0]?.product?.wholesaler_id;

      // Create main order
      const { data: order, error: orderError } = await supabase
        .from('marketplace_orders')
        .insert([{
          user_id: user.id,
          wholesaler_id: firstWholesalerId,
          shipping_address: data.shippingAddress as any,
          billing_address: (data.billingAddress || data.shippingAddress) as any,
          order_type: userRole === 'store' || userRole === 'store_owner' ? 'store' : 'customer',
          payment_status: data.paymentMethod === 'card' ? 'pending' : 'pending',
          fulfillment_status: 'pending',
          subtotal: data.totals.subtotal,
          shipping_cost: data.totals.shipping,
          tax_amount: data.totals.tax,
          total: data.totals.total,
          shipping_funded_by_customer: true,
          notes: data.notes,
        }])
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = data.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        wholesaler_id: item.product?.wholesaler_id,
        qty: item.qty,
        price_each: item.price_locked || 0,
      }));

      const { error: itemsError } = await supabase
        .from('marketplace_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Create order routing entries for each wholesaler
      for (const [wholesalerId, items] of wholesalerGroups) {
        if (wholesalerId !== 'unknown') {
          const { error: routingError } = await supabase
            .from('order_routing')
            .insert({
              order_id: order.id,
              assigned_wholesaler_id: wholesalerId,
              pickup_required: data.deliveryType === 'pickup',
              cash_collection: data.paymentMethod === 'cash',
              cash_amount: data.paymentMethod === 'cash' ? data.totals.total : 0,
              delivery_type: data.deliveryType,
              status: 'pending',
            });

          if (routingError) console.error('Routing error:', routingError);

          // Create shipping label placeholder
          if (data.deliveryType === 'ship') {
            await supabase
              .from('shipping_labels')
              .insert({
                order_id: order.id,
                status: 'pending',
              });
          }
        }
      }

      return {
        orderId: order.id,
        orderNumber: order.id.slice(0, 8).toUpperCase(),
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order placed successfully!');
    },
    onError: (error) => {
      toast.error(`Checkout failed: ${error.message}`);
    },
  });

  return {
    validateCheckout,
    createOrder: createOrderMutation.mutateAsync,
    isCreatingOrder: createOrderMutation.isPending,
  };
}
