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

  // Resolve user's store from user_store_map
  const resolveUserStore = async (userId: string) => {
    const { data } = await supabase
      .from('user_store_map')
      .select('store_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    return data?.store_id || null;
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

    // Cash/Net terms available for store accounts and admins
    if (data.paymentMethod !== 'card' && !['store', 'store_owner', 'admin', 'owner'].includes(userRole || '')) {
      errors.push('Cash and net terms are only available for authorized accounts');
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

      // Create main marketplace order
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

      const orderNumber = order.id.slice(0, 8).toUpperCase();

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

      // ═══════════════════════════════════════════════════════════
      // SPRINT 1: FAN-OUT FULFILLMENTS + RESERVE INVENTORY
      // One marketplace_fulfillments row per supplier — what brings
      // the entire supplier portal to life. Inventory is reserved
      // atomically per item (RPC throws on insufficient_stock).
      // ═══════════════════════════════════════════════════════════
      for (const [wholesalerId, items] of wholesalerGroups) {
        if (wholesalerId === 'unknown') continue;

        for (const item of items) {
          if (!item.product_id) continue;
          try {
            await supabase.rpc('reserve_marketplace_inventory', {
              p_product_id: item.product_id,
              p_wholesaler_id: wholesalerId,
              p_qty: item.qty,
            });
          } catch (err: any) {
            const msg = err?.message || String(err);
            if (msg.includes('insufficient_stock')) {
              throw new Error(`Out of stock: ${item.product?.product_name || item.product_id}`);
            }
            console.error('reserve_marketplace_inventory failed:', err);
          }
        }

        const itemsSnapshot = items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product?.product_name,
          qty: it.qty,
          price_each: it.price_locked || 0,
        }));

        const { error: fulfillmentError } = await supabase
          .from('marketplace_fulfillments')
          .insert({
            order_id: order.id,
            wholesaler_id: wholesalerId,
            status: 'pending',
            items_snapshot: itemsSnapshot,
            shipping_mode: 'sandbox', // flips to 'live' the moment EASYPOST_API_KEY is set
          });
        if (fulfillmentError) console.error('Fulfillment fan-out error:', fulfillmentError);

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

        if (data.deliveryType === 'ship') {
          await supabase.from('shipping_labels').insert({
            order_id: order.id,
            status: 'pending',
          });
        }
      }

      // === BRIDGE: Auto-create store_orders record for dispatch/assignments ===
      const storeId = await resolveUserStore(user.id);
      
      if (storeId) {
        const deliveryAddress = `${data.shippingAddress.street}, ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}`;
        
        const { data: storeOrder, error: storeOrderError } = await supabase
          .from('store_orders')
          .insert({
            store_id: storeId,
            marketplace_order_id: order.id,
            order_number: `MKT-${orderNumber}`,
            status: 'pending',
            payment_status: 'unpaid',
            payment_method: data.paymentMethod === 'net_terms' ? 'invoice' : data.paymentMethod,
            subtotal: data.totals.subtotal,
            tax: data.totals.tax,
            delivery_fee: data.totals.shipping,
            total_amount: data.totals.total,
            recipient_name: data.shippingAddress.fullName,
            recipient_phone: data.shippingAddress.phone,
            delivery_address: deliveryAddress,
            notes: data.notes,
          })
          .select('id')
          .single();

        if (storeOrderError) {
          console.error('Store order creation error:', storeOrderError);
        }

        // === BRIDGE: Auto-create invoice (financial truth) ===
        if (storeOrder) {
          const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30); // Net 30

          const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
              invoice_number: invoiceNumber,
              store_id: storeId,
              order_id: storeOrder.id,
              entity_type: 'store',
              entity_id: storeId,
              subtotal: data.totals.subtotal,
              tax: data.totals.tax,
              total: data.totals.total,
              total_amount: data.totals.total,
              due_date: dueDate.toISOString().split('T')[0],
              status: 'draft',
              payment_status: 'unpaid',
              payment_method: data.paymentMethod,
              pricing_mode: 'retail',
              notes: `Auto-generated from marketplace order ${orderNumber}`,
              created_by: user.id,
            })
            .select('id')
            .single();

          if (invoiceError) {
            console.error('Invoice creation error:', invoiceError);
          }

          // Create invoice line items
          if (invoice) {
            const lineItems = data.items.map(item => ({
              invoice_id: invoice.id,
              product_id: item.product_id,
              product_name: item.product?.product_name || 'Unknown Product',
              product_name_snapshot: item.product?.product_name || 'Unknown Product',
              brand: (item.product as any)?.brand || null,
              brand_name_snapshot: (item.product as any)?.brand || null,
              quantity: item.qty,
              unit_price: item.price_locked || 0,
              total: (item.price_locked || 0) * item.qty,
              line_subtotal: (item.price_locked || 0) * item.qty,
              unit_price_used: item.price_locked || 0,
              list_unit_price: item.price_locked || 0,
              sale_channel: 'retail',
              pricing_mode: 'retail',
            }));

            const { error: lineItemsError } = await supabase
              .from('invoice_line_items')
              .insert(lineItems);

            if (lineItemsError) {
              console.error('Invoice line items error:', lineItemsError);
            }
          }
        }
      }

      // ═══════════════════════════════════════════════════════════
      // SPRINT 5: NETWORK BRAIN — geographic supplier routing.
      // Reroutes items to the best supplier per priority rules
      // (manual pin → weighted → in-state → nearest → default),
      // re-points fulfillments, and logs the decision.
      // ═══════════════════════════════════════════════════════════
      try {
        await supabase.rpc('route_order_to_supplier', { p_order_id: order.id });
      } catch (e) {
        console.warn('route_order_to_supplier failed (non-fatal):', e);
      }

      return {
        orderId: order.id,
        orderNumber,
      };
    },
    onSuccess: () => {
      // Invalidate all related queries so every page refreshes
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-orders'] });
      queryClient.invalidateQueries({ queryKey: ['store-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['store-orders'] });
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
