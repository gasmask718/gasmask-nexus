import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useWholesalerProfile } from "./useWholesalerProfile";

export interface WholesalerProduct {
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
}

export interface CreateProductData {
  product_name: string;
  description?: string;
  brand_id?: string;
  images?: string[];
  unit_type?: string;
  inventory_qty?: number;
  weight_oz?: number;
  dimensions?: { length: number; width: number; height: number };
  retail_price?: number;
  store_price?: number;
  wholesale_price?: number;
  shipping_from_city?: string;
  shipping_from_state?: string;
  processing_time?: string;
}

export function useWholesalerProducts() {
  const { user } = useAuth();
  const { profile } = useWholesalerProfile();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ['wholesaler-products', profile?.id],
    queryFn: async () => {
      if (!profile) return [];

      const { data, error } = await supabase
        .from('products_all')
        .select(`
          *,
          brand:brands(name, color)
        `)
        .eq('wholesaler_id', profile.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(p => ({
        ...p,
        images: Array.isArray(p.images) ? p.images : [],
        dimensions: p.dimensions as { length: number; width: number; height: number } | null,
      })) as WholesalerProduct[];
    },
    enabled: !!profile,
  });

  const createProduct = useMutation({
    mutationFn: async (data: CreateProductData) => {
      if (!profile) throw new Error('No wholesaler profile');

      const { data: product, error } = await supabase
        .from('products_all')
        .insert([{
          ...data,
          wholesaler_id: profile.id,
          status: 'active',
        }])
        .select()
        .single();

      if (error) throw error;
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-products'] });
      toast.success('Product created');
    },
    onError: (error) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateProductData>) => {
      const { error } = await supabase
        .from('products_all')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-products'] });
      toast.success('Product updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products_all')
        .update({ status: 'deleted' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-products'] });
      toast.success('Product deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const updateInventory = useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      const { error } = await supabase
        .from('products_all')
        .update({ inventory_qty: qty })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-products'] });
      toast.success('Inventory updated');
    },
  });

  const lowStockProducts = productsQuery.data?.filter(
    p => p.inventory_qty !== null && p.inventory_qty < 10
  ) || [];

  return {
    products: productsQuery.data || [],
    isLoading: productsQuery.isLoading,
    lowStockProducts,
    createProduct: createProduct.mutateAsync,
    updateProduct: updateProduct.mutateAsync,
    deleteProduct: deleteProduct.mutateAsync,
    updateInventory: updateInventory.mutateAsync,
    isCreating: createProduct.isPending,
  };
}

export function useWholesalerProduct(productId: string) {
  const { profile } = useWholesalerProfile();

  return useQuery({
    queryKey: ['wholesaler-product', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products_all')
        .select(`
          *,
          brand:brands(name, color)
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        images: Array.isArray(data.images) ? data.images : [],
        dimensions: data.dimensions as { length: number; width: number; height: number } | null,
      } as WholesalerProduct;
    },
    enabled: !!productId && !!profile,
  });
}
