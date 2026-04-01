import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSupplierVolumeHistory(supplierId?: string) {
  return useQuery({
    queryKey: ['ut-supplier-volume', supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_supplier_volume_history') as any)
        .select('*')
        .eq('supplier_id', supplierId)
        .order('period_month', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useReorderRules(categoryId?: string) {
  return useQuery({
    queryKey: ['ut-reorder-rules', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_reorder_rules') as any)
        .select('*')
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSupplierFeedback(supplierId?: string) {
  return useQuery({
    queryKey: ['ut-supplier-feedback', supplierId],
    queryFn: async () => {
      let q = (supabase.from('ut_supplier_feedback') as any).select('*').order('created_at', { ascending: false }).limit(50);
      if (supplierId) q = q.eq('supplier_id', supplierId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSupplierLeaderboard() {
  return useQuery({
    queryKey: ['ut-supplier-leaderboard'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_supplier_feedback') as any)
        .select('*')
        .order('overall_score', { ascending: false })
        .limit(100);
      if (error) throw error;
      // Aggregate by supplier
      const map = new Map<string, { name: string; scores: number[]; quality: number[]; speed: number[]; branding: number[]; comms: number[] }>();
      (data || []).forEach((r: any) => {
        const key = r.supplier_name;
        if (!map.has(key)) map.set(key, { name: key, scores: [], quality: [], speed: [], branding: [], comms: [] });
        const e = map.get(key)!;
        e.scores.push(Number(r.overall_score));
        e.quality.push(Number(r.quality_score));
        e.speed.push(Number(r.speed_score));
        e.branding.push(Number(r.branding_score));
        e.comms.push(Number(r.communication_score));
      });
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      return Array.from(map.values()).map(e => ({
        supplier_name: e.name,
        avg_overall: avg(e.scores),
        avg_quality: avg(e.quality),
        avg_speed: avg(e.speed),
        avg_branding: avg(e.branding),
        avg_comms: avg(e.comms),
        review_count: e.scores.length,
      })).sort((a, b) => b.avg_overall - a.avg_overall);
    },
  });
}

export function useGSCSMutations() {
  const qc = useQueryClient();

  const addReorderRule = useMutation({
    mutationFn: async (rule: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_reorder_rules') as any).insert(rule).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-reorder-rules'] }); toast.success('Reorder rule created'); },
    onError: (e: any) => toast.error(e.message),
  });

  const addFeedback = useMutation({
    mutationFn: async (fb: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_supplier_feedback') as any).insert(fb).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-supplier-feedback'] });
      qc.invalidateQueries({ queryKey: ['ut-supplier-leaderboard'] });
      toast.success('Feedback submitted');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCategorySupplier = useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { error } = await (supabase.from('ut_category_suppliers') as any).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-category-suppliers'] }); toast.success('Supplier updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  return { addReorderRule, addFeedback, updateCategorySupplier };
}
