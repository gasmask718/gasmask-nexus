import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Grabba brand IDs from the database
export const GRABBA_COMPANY_IDS = {
  gasmask: 'fb52b0e6-39b2-4e13-bea9-cd016f51efb0',
  hotmama: 'f3e8ba65-2b76-4f61-a157-0751acb3e7b2',
  scalati: 'c9d60b82-f0d3-44b4-9b33-1abe4adf1ebe',
  grabba: '4b1c1255-b7b1-43ea-9ad9-a257c6582094',
} as const;

export const GRABBA_COMPANIES = [
  { id: GRABBA_COMPANY_IDS.gasmask, name: 'GasMask', color: '#FF0000', icon: '🔴' },
  { id: GRABBA_COMPANY_IDS.hotmama, name: 'HotMama', color: '#FF4F9D', icon: '💖' },
  { id: GRABBA_COMPANY_IDS.scalati, name: 'Hot Scolatti', color: '#FF7A00', icon: '🟠' },
  { id: GRABBA_COMPANY_IDS.grabba, name: 'Grabba R Us', color: '#A020F0', icon: '🟪' },
] as const;

export interface VisitProduct {
  id: string;
  visit_id: string;
  store_id: string;
  brand_id: string;
  product_id: string;
  quantity: number;
  unit_type: 'standard' | 'custom';
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    wholesale_price: number;
    units_per_box: number;
  };
  brand?: {
    id: string;
    name: string;
  };
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  wholesale_price: number | null;
  units_per_box: number | null;
  brand_id: string;
}

// Fetch products by brand
export function useProductsByBrand(brandId: string | null) {
  return useQuery({
    queryKey: ['products-by-brand', brandId],
    queryFn: async () => {
      if (!brandId) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, wholesale_price, units_per_box, brand_id')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as ProductOption[];
    },
    enabled: !!brandId,
  });
}

// Fetch visit products for a store
export function useStoreVisitProducts(storeId: string) {
  return useQuery({
    queryKey: ['store-visit-products', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_products')
        .select(`
          *,
          product:products(id, name, sku, wholesale_price, units_per_box),
          brand:brands(id, name)
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as VisitProduct[];
    },
    enabled: !!storeId,
  });
}

// Get aggregated inventory by brand for a store
export function useStoreVisitInventory(storeId: string) {
  return useQuery({
    queryKey: ['store-visit-inventory', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_products')
        .select(`
          brand_id,
          product_id,
          quantity,
          created_at,
          product:products(id, name, sku),
          brand:brands(id, name)
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Aggregate by product
      const aggregated = new Map<string, {
        product_id: string;
        product_name: string;
        brand_id: string;
        brand_name: string;
        total_quantity: number;
        last_visit_date: string;
      }>();

      for (const item of data || []) {
        const key = item.product_id;
        const existing = aggregated.get(key);
        
        if (existing) {
          existing.total_quantity += item.quantity;
          if (new Date(item.created_at) > new Date(existing.last_visit_date)) {
            existing.last_visit_date = item.created_at;
          }
        } else {
          aggregated.set(key, {
            product_id: item.product_id,
            product_name: (item.product as any)?.name || 'Unknown',
            brand_id: item.brand_id,
            brand_name: (item.brand as any)?.name || 'Unknown',
            total_quantity: item.quantity,
            last_visit_date: item.created_at,
          });
        }
      }

      return Array.from(aggregated.values());
    },
    enabled: !!storeId,
  });
}

// Create visit products
export interface CreateVisitProductInput {
  visit_id: string;
  store_id: string;
  brand_id: string;
  product_id: string;
  quantity: number;
  unit_type: 'standard' | 'custom';
}

export function useCreateVisitProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (products: CreateVisitProductInput[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const productsWithUser = products.map(p => ({
        ...p,
        created_by: user?.id,
      }));

      const { data, error } = await supabase
        .from('visit_products')
        .insert(productsWithUser)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      const storeIds = [...new Set(variables.map(p => p.store_id))];
      storeIds.forEach(storeId => {
        queryClient.invalidateQueries({ queryKey: ['store-visit-products', storeId] });
        queryClient.invalidateQueries({ queryKey: ['store-visit-inventory', storeId] });
        queryClient.invalidateQueries({ queryKey: ['store-tube-inventory', storeId] });
      });
    },
  });
}

// Update store tube inventory after visit
export function useUpdateStoreTubeInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      storeId, 
      brandUpdates 
    }: { 
      storeId: string; 
      brandUpdates: { brand: string; quantity: number }[] 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      for (const update of brandUpdates) {
        // Get current inventory
        const { data: existing } = await supabase
          .from('store_tube_inventory')
          .select('id, current_tubes_left')
          .eq('store_id', storeId)
          .eq('brand', update.brand)
          .single();

        if (existing) {
          // Update existing - ADD to current count
          await supabase
            .from('store_tube_inventory')
            .update({
              current_tubes_left: (existing.current_tubes_left || 0) + update.quantity,
              last_updated: new Date().toISOString(),
              created_by: user?.id || 'system',
            })
            .eq('id', existing.id);
        } else {
          // Create new record
          await supabase
            .from('store_tube_inventory')
            .insert({
              store_id: storeId,
              brand: update.brand,
              current_tubes_left: update.quantity,
              created_by: user?.id || 'system',
            });
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['store-tube-inventory', variables.storeId] });
    },
  });
}
