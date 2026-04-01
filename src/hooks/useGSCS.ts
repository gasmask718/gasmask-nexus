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

// --- NEW: Pricing trends ---
export function useSupplierPriceHistory(supplierName?: string) {
  return useQuery({
    queryKey: ['ut-supplier-price-history', supplierName],
    queryFn: async () => {
      let q = (supabase.from('ut_supplier_price_history') as any).select('*').order('recorded_at', { ascending: false }).limit(100);
      if (supplierName) q = q.eq('supplier_name', supplierName);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

// --- NEW: Automation rules ---
export function useGSCSAutomationRules() {
  return useQuery({
    queryKey: ['ut-gscs-automation-rules'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_gscs_automation_rules') as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// --- NEW: Approvals ---
export function useGSCSApprovals(status?: string) {
  return useQuery({
    queryKey: ['ut-gscs-approvals', status],
    queryFn: async () => {
      let q = (supabase.from('ut_gscs_approvals') as any).select('*').order('created_at', { ascending: false }).limit(50);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
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

  // Price history
  const addPriceRecord = useMutation({
    mutationFn: async (rec: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_supplier_price_history') as any).insert(rec).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-supplier-price-history'] }); toast.success('Price record added'); },
    onError: (e: any) => toast.error(e.message),
  });

  // Automation rules
  const addAutomationRule = useMutation({
    mutationFn: async (rule: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_gscs_automation_rules') as any).insert(rule).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-gscs-automation-rules'] }); toast.success('Automation rule created'); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAutomationRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from('ut_gscs_automation_rules') as any).update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-gscs-automation-rules'] }); toast.success('Rule updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  // Approvals
  const createApproval = useMutation({
    mutationFn: async (a: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_gscs_approvals') as any).insert(a).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-gscs-approvals'] }); toast.success('Approval request created'); },
    onError: (e: any) => toast.error(e.message),
  });

  const resolveApproval = useMutation({
    mutationFn: async ({ id, status, reviewer_notes }: { id: string; status: string; reviewer_notes?: string }) => {
      const { error } = await (supabase.from('ut_gscs_approvals') as any).update({ status, reviewer_notes, reviewed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ut-gscs-approvals'] }); toast.success('Approval resolved'); },
    onError: (e: any) => toast.error(e.message),
  });

  return { addReorderRule, addFeedback, updateCategorySupplier, addPriceRecord, addAutomationRule, toggleAutomationRule, createApproval, resolveApproval };
}
