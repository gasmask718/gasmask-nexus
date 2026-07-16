import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MarketplaceProduct {
  id: string;
  wholesaler_id: string | null;
  brand_id: string | null;
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
  created_at: string | null;
  brand?: { name: string; color: string | null } | null;
  wholesaler?: { company_name: string } | null;
}

export function useProducts(filters?: {
  brandId?: string;
  search?: string;
  category?: string;
}) {
  return useQuery({
    queryKey: ['marketplace-products', filters],
    queryFn: async () => {
      let query = supabase
        .from('products_all')
        .select(`
          *,
          brand:brands(name, color),
          wholesaler:wholesaler_profiles(company_name)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (filters?.brandId) {
        query = query.eq('brand_id', filters.brandId);
      }

      if (filters?.search) {
        query = query.ilike('product_name', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Prefer authoritative Dynasty Direct pricing columns (dtc_price_b / store_price_a);
      // fall back to legacy retail_price / store_price for non-DD rows.
      return (data || []).map((p: any) => ({
        ...p,
        retail_price: p.dtc_price_b ?? p.retail_price,
        store_price:  p.store_price_a ?? p.store_price,
        images: Array.isArray(p.images) ? p.images : [],
        dimensions: p.dimensions as { length: number; width: number; height: number } | null,
      })) as MarketplaceProduct[];
    },
  });
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: ['marketplace-product', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products_all')
        .select(`
          *,
          brand:brands(name, color),
          wholesaler:wholesaler_profiles(company_name)
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;

      const p: any = data;
      return {
        ...p,
        retail_price: p.dtc_price_b ?? p.retail_price,
        store_price:  p.store_price_a ?? p.store_price,
        images: Array.isArray(p.images) ? p.images : [],
        dimensions: p.dimensions as { length: number; width: number; height: number } | null,
      } as MarketplaceProduct;
    },
    enabled: !!productId,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ['marketplace-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });
}
