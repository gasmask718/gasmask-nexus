import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useDominationCategories() {
  return useQuery({
    queryKey: ['ut-domination-categories'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_domination_categories') as any)
        .select('*')
        .order('total_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCategorySuppliers(categoryId?: string) {
  return useQuery({
    queryKey: ['ut-category-suppliers', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_category_suppliers') as any)
        .select('*')
        .eq('category_id', categoryId)
        .order('performance_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCategoryPricing(categoryId?: string) {
  return useQuery({
    queryKey: ['ut-category-pricing', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_category_pricing') as any)
        .select('*')
        .eq('category_id', categoryId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
  });
}

export function useCategoryBranding(categoryId?: string) {
  return useQuery({
    queryKey: ['ut-category-branding', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_category_branding') as any)
        .select('*')
        .eq('category_id', categoryId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
  });
}

export function useCategoryPerformance(categoryId?: string) {
  return useQuery({
    queryKey: ['ut-category-performance', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_category_performance') as any)
        .select('*')
        .eq('category_id', categoryId)
        .order('period_month', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCategoryExpansion(categoryId?: string) {
  return useQuery({
    queryKey: ['ut-category-expansion', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_category_expansion_queue') as any)
        .select('*')
        .eq('category_id', categoryId)
        .order('ai_confidence', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCategoryMutations() {
  const qc = useQueryClient();

  const createCategory = useMutation({
    mutationFn: async (cat: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_domination_categories') as any).insert(cat).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-domination-categories'] }); toast.success('Category created'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...u }: Record<string, any>) => {
      const { error } = await (supabase.from('ut_domination_categories') as any).update({ ...u, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-domination-categories'] }); toast.success('Category updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  const addCategorySupplier = useMutation({
    mutationFn: async (s: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_category_suppliers') as any).insert(s).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-category-suppliers'] }); toast.success('Supplier linked'); },
    onError: (e: any) => toast.error(e.message),
  });

  const upsertPricing = useMutation({
    mutationFn: async (p: Record<string, any>) => {
      const { error } = await (supabase.from('ut_category_pricing') as any).upsert(p, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-category-pricing'] }); toast.success('Pricing saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const upsertBranding = useMutation({
    mutationFn: async (b: Record<string, any>) => {
      const { error } = await (supabase.from('ut_category_branding') as any).upsert(b, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-category-branding'] }); toast.success('Branding saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const resolveExpansion = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from('ut_category_expansion_queue') as any)
        .update({ status, resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-category-expansion'] }); toast.success('Recommendation resolved'); },
    onError: (e: any) => toast.error(e.message),
  });

  return { createCategory, updateCategory, addCategorySupplier, upsertPricing, upsertBranding, resolveExpansion };
}
