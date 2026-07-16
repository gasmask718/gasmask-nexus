import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DynastyDirectProduct {
  id: string;
  product_name: string;
  description: string | null;
  images: string[];
  unit_type: string | null;
  inventory_qty: number | null;
  weight_oz: number | null;
  dimensions: { length: number; width: number; height: number } | null;
  retail_price: number | null;
  store_price: number | null;
  wholesale_price: number | null;
  shipping_from_city: string | null;
  shipping_from_state: string | null;
  processing_time: string | null;
  status: string | null;
  street_price: number | null;
  created_at: string | null;
  wholesaler_id: string | null;
  brand?: { name: string; color: string | null } | null;
}

/**
 * Hook to fetch wholesaler marketplace products from products_all
 * These are Dynasty Direct products available for stores to order
 */
export function useDynastyDirectProducts(filters?: { search?: string }) {
  return useQuery({
    queryKey: ['dynasty-direct-products', filters],
    queryFn: async () => {
      let query = supabase
        .from('products_all')
        .select(`
          *,
          brand:brands(name, color)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.ilike('product_name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Dynasty Direct pricing lives in dtc_price_b / store_price_a (authoritative,
      // written by dd_update_product_pricing). Legacy retail_price / store_price
      // columns are unused for DD storefront — prefer the real columns, fall back
      // to legacy only if the new columns aren't populated yet.
      return (data || []).map((p: any) => ({
        ...p,
        retail_price: p.dtc_price_b ?? p.retail_price,
        store_price:  p.store_price_a ?? p.store_price,
        images: Array.isArray(p.images) ? p.images : [],
        dimensions: p.dimensions as { length: number; width: number; height: number } | null,
      })) as DynastyDirectProduct[];
    },
  });
}
