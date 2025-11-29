import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StoreOrder {
  id: string;
  user_id: string;
  wholesaler_id: string | null;
  shipping_address: Record<string, any> | null;
  billing_address: Record<string, any> | null;
  order_type: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  subtotal: number | null;
  shipping_cost: number | null;
  tax_amount: number | null;
  total: number | null;
  notes: string | null;
  created_at: string | null;
  items?: StoreOrderItem[];
  wholesaler?: { company_name: string } | null;
  shipping_label?: { tracking_number: string | null; carrier: string | null } | null;
}

export interface StoreOrderItem {
  id: string;
  product_id: string | null;
  qty: number | null;
  price_each: number | null;
  product?: {
    product_name: string;
    images: string[];
  } | null;
}

export function useStoreOrders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['store-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('marketplace_orders')
        .select(`
          *,
          wholesaler:wholesaler_profiles(company_name),
          items:marketplace_order_items(
            id,
            product_id,
            qty,
            price_each,
            product:products_all(product_name, images)
          ),
          shipping_label:shipping_labels(tracking_number, carrier)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(order => ({
        ...order,
        shipping_address: order.shipping_address as Record<string, any> | null,
        billing_address: order.billing_address as Record<string, any> | null,
        items: order.items?.map((item: any) => ({
          ...item,
          product: item.product ? {
            ...item.product,
            images: Array.isArray(item.product.images) ? item.product.images : [],
          } : null,
        })),
        shipping_label: Array.isArray(order.shipping_label) ? order.shipping_label[0] : order.shipping_label,
      })) as StoreOrder[];
    },
    enabled: !!user,
  });
}

export function useStoreOrder(orderId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['store-order', orderId],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('marketplace_orders')
        .select(`
          *,
          wholesaler:wholesaler_profiles(company_name),
          items:marketplace_order_items(
            id,
            product_id,
            qty,
            price_each,
            product:products_all(product_name, images)
          ),
          shipping_label:shipping_labels(tracking_number, carrier, label_url)
        `)
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return {
        ...data,
        shipping_address: data.shipping_address as Record<string, any> | null,
        billing_address: data.billing_address as Record<string, any> | null,
        items: data.items?.map((item: any) => ({
          ...item,
          product: item.product ? {
            ...item.product,
            images: Array.isArray(item.product.images) ? item.product.images : [],
          } : null,
        })),
        shipping_label: Array.isArray(data.shipping_label) ? data.shipping_label[0] : data.shipping_label,
      } as StoreOrder;
    },
    enabled: !!user && !!orderId,
  });
}
