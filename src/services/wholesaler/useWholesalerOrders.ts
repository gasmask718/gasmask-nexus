import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWholesalerProfile } from "./useWholesalerProfile";

export interface WholesalerOrder {
  id: string;
  user_id: string;
  wholesaler_id: string | null;
  shipping_address: any;
  billing_address: any;
  order_type: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  subtotal: number | null;
  shipping_cost: number | null;
  tax_amount: number | null;
  total: number | null;
  notes: string | null;
  created_at: string | null;
  items?: WholesalerOrderItem[];
  routing?: OrderRouting | null;
  shipping_label?: ShippingLabel | null;
}

export interface WholesalerOrderItem {
  id: string;
  product_id: string | null;
  qty: number | null;
  price_each: number | null;
  product?: {
    product_name: string;
    images: any;
  } | null;
}

export interface OrderRouting {
  id: string;
  order_id: string;
  status: string | null;
  delivery_type: string | null;
}

export interface ShippingLabel {
  id: string;
  order_id: string;
  carrier: string | null;
  tracking_number: string | null;
  label_url: string | null;
  status: string | null;
}

type OrderStatus = 'pending' | 'processing' | 'label_created' | 'shipped' | 'delivered' | 'cancelled';

export function useWholesalerOrders(status?: OrderStatus) {
  const { profile } = useWholesalerProfile();
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['wholesaler-orders', profile?.id, status],
    queryFn: async () => {
      if (!profile) return [];

      let query = supabase
        .from('marketplace_orders')
        .select(`
          *,
          items:marketplace_order_items(
            id,
            product_id,
            qty,
            price_each,
            product:products_all(product_name, images)
          ),
          routing:order_routing(*),
          shipping_label:shipping_labels(*)
        `)
        .eq('wholesaler_id', profile.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('fulfillment_status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return (data || []).map(order => ({
        ...order,
        items: (order.items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          qty: item.qty,
          price_each: item.price_each,
          product: item.product,
        })),
        routing: Array.isArray(order.routing) ? order.routing[0] : order.routing,
        shipping_label: Array.isArray(order.shipping_label) ? order.shipping_label[0] : order.shipping_label,
      })) as WholesalerOrder[];
    },
    enabled: !!profile,
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { error } = await supabase
        .from('marketplace_orders')
        .update({ fulfillment_status: status })
        .eq('id', orderId);

      if (error) throw error;

      if (status === 'shipped') {
        await supabase
          .from('order_routing')
          .update({ status: 'completed' })
          .eq('order_id', orderId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-orders'] });
      toast.success('Order status updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const updateTrackingNumber = useMutation({
    mutationFn: async ({ orderId, trackingNumber, carrier }: { 
      orderId: string; 
      trackingNumber: string; 
      carrier?: string;
    }) => {
      const { error } = await supabase
        .from('shipping_labels')
        .update({ 
          tracking_number: trackingNumber,
          carrier: carrier || 'unknown',
          status: 'created',
        })
        .eq('order_id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-orders'] });
      toast.success('Tracking number added');
    },
  });

  const pendingCount = ordersQuery.data?.filter(o => o.fulfillment_status === 'pending').length || 0;
  const processingCount = ordersQuery.data?.filter(o => o.fulfillment_status === 'processing').length || 0;
  const shippedCount = ordersQuery.data?.filter(o => o.fulfillment_status === 'shipped').length || 0;

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    pendingCount,
    processingCount,
    shippedCount,
    updateOrderStatus: updateOrderStatus.mutateAsync,
    updateTrackingNumber: updateTrackingNumber.mutateAsync,
  };
}

export function useWholesalerOrder(orderId: string) {
  const { profile } = useWholesalerProfile();

  return useQuery({
    queryKey: ['wholesaler-order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select(`
          *,
          items:marketplace_order_items(
            id,
            product_id,
            qty,
            price_each,
            product:products_all(product_name, images)
          ),
          routing:order_routing(*),
          shipping_label:shipping_labels(*)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        items: (data.items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          qty: item.qty,
          price_each: item.price_each,
          product: item.product,
        })),
        routing: Array.isArray(data.routing) ? data.routing[0] : data.routing,
        shipping_label: Array.isArray(data.shipping_label) ? data.shipping_label[0] : data.shipping_label,
      } as WholesalerOrder;
    },
    enabled: !!orderId && !!profile,
  });
}
