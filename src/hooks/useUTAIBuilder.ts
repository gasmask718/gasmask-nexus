import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════
// INGESTION JOBS
// ═══════════════════════════════════════

export function useIngestionJobs(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-ai-ingestion', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_ai_ingestion_jobs')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

// ═══════════════════════════════════════
// EXTRACTED DATA
// ═══════════════════════════════════════

export function useExtractedData(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-ai-extracted', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_ai_extracted_data')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useApproveExtracted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('ut_ai_extracted_data')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-ai-extracted'] });
      toast.success('Item updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// SUGGESTIONS
// ═══════════════════════════════════════

export function useAISuggestions(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-ai-suggestions', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_ai_suggestions')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ut_ai_suggestions')
        .update({ status: 'dismissed' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ut-ai-suggestions'] }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// GENERATED LISTINGS
// ═══════════════════════════════════════

export function useGeneratedListings(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-ai-listings', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_ai_generated_listings')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

// ═══════════════════════════════════════
// AI ACTIONS (calls edge function)
// ═══════════════════════════════════════

export function useAIExtract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { partner_id: string; content: string; category?: string; input_type?: string }) => {
      const { data, error } = await supabase.functions.invoke('ut-ai-business-builder', {
        body: { action: 'extract', ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-ai-ingestion'] });
      qc.invalidateQueries({ queryKey: ['ut-ai-extracted'] });
      toast.success('AI extraction complete!');
    },
    onError: (e: any) => toast.error(e.message || 'Extraction failed'),
  });
}

export function useAIAutoBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partner_id: string) => {
      const { data, error } = await supabase.functions.invoke('ut-ai-business-builder', {
        body: { action: 'auto_build', partner_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-ai-extracted'] });
      qc.invalidateQueries({ queryKey: ['ut-partner-menus'] });
      qc.invalidateQueries({ queryKey: ['ut-menu-items'] });
      qc.invalidateQueries({ queryKey: ['ut-service-packages'] });
      toast.success('Auto-build complete! Items added to your profile.');
    },
    onError: (e: any) => toast.error(e.message || 'Auto-build failed'),
  });
}

export function useAIGenerateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { partner_id: string; category?: string }) => {
      const { data, error } = await supabase.functions.invoke('ut-ai-business-builder', {
        body: { action: 'generate_listing', ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-ai-listings'] });
      toast.success('Listing generated!');
    },
    onError: (e: any) => toast.error(e.message || 'Listing generation failed'),
  });
}

export function useAIGenerateSuggestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partner_id: string) => {
      const { data, error } = await supabase.functions.invoke('ut-ai-business-builder', {
        body: { action: 'generate_suggestions', partner_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-ai-suggestions'] });
      toast.success('AI suggestions refreshed');
    },
    onError: (e: any) => toast.error(e.message || 'Suggestions failed'),
  });
}

export function useAIAutoPackages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partner_id: string) => {
      const { data, error } = await supabase.functions.invoke('ut-ai-business-builder', {
        body: { action: 'auto_packages', partner_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-ai-extracted'] });
      toast.success('AI packages generated! Review and approve them.');
    },
    onError: (e: any) => toast.error(e.message || 'Package generation failed'),
  });
}
