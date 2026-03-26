import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useUTProducts(filters?: {
  product_type?: string;
  category?: string;
  is_trending?: boolean;
  recommendation_level?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['ut-products', filters],
    queryFn: async () => {
      let q = (supabase.from('v_ut_product_summary') as any).select('*');
      if (filters?.product_type) q = q.eq('product_type', filters.product_type);
      if (filters?.category) q = q.eq('category', filters.category);
      if (filters?.is_trending) q = q.eq('is_trending', true);
      if (filters?.recommendation_level) q = q.eq('recommendation_level', filters.recommendation_level);
      if (filters?.search) q = q.ilike('name', `%${filters.search}%`);
      q = q.order('overall_score', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUTSuppliers() {
  return useQuery({
    queryKey: ['ut-suppliers'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('v_ut_supplier_scorecard') as any)
        .select('*')
        .order('avg_product_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUTProductCategories() {
  return useQuery({
    queryKey: ['ut-product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ut_product_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUTProductMutations() {
  const qc = useQueryClient();

  const createProduct = useMutation({
    mutationFn: async (product: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_products') as any).insert(product).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-products'] });
      toast.success('Product created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { error } = await (supabase.from('ut_products') as any).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-products'] });
      toast.success('Product updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createSupplier = useMutation({
    mutationFn: async (supplier: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_suppliers') as any).insert(supplier).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-suppliers'] });
      toast.success('Supplier created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const scoreProducts = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('ut_score_products' as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['ut-products'] });
      toast.success(`Scored ${count} products`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { createProduct, updateProduct, createSupplier, scoreProducts };
}
