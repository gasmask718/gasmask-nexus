import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════
// CREATIVE PROFILE
// ═══════════════════════════════════════

export function useCreativeProfile(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-creative-profile', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      const { data, error } = await supabase
        .from('ut_partner_creative_profiles')
        .select('*')
        .eq('partner_id', partnerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });
}

export function useUpsertCreativeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_creative_profiles')
        .upsert({ ...profile, updated_at: new Date().toISOString() } as any, { onConflict: 'partner_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-creative-profile'] });
      toast.success('Creative profile saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// COLLECTIONS
// ═══════════════════════════════════════

export function useCreativeCollections(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-creative-collections', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_creative_collections')
        .select('*')
        .eq('partner_id', partnerId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (col: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_creative_collections')
        .upsert({ ...col, updated_at: new Date().toISOString() } as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-creative-collections'] });
      toast.success('Collection saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// OFFERINGS
// ═══════════════════════════════════════

export function useCreativeOfferings(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-creative-offerings', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_creative_offerings')
        .select('*')
        .eq('partner_id', partnerId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertOffering() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (off: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_creative_offerings')
        .upsert(off as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-creative-offerings'] });
      toast.success('Offering saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// CREATIVE MEDIA / PORTFOLIO
// ═══════════════════════════════════════

export function useCreativeMedia(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-creative-media', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_creative_media')
        .select('*')
        .eq('partner_id', partnerId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

// ═══════════════════════════════════════
// CREATIVE PACKAGES
// ═══════════════════════════════════════

export function useCreativePackages(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-creative-packages', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_creative_packages')
        .select('*')
        .eq('partner_id', partnerId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertCreativePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pkg: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_creative_packages')
        .upsert({ ...pkg, updated_at: new Date().toISOString() } as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-creative-packages'] });
      toast.success('Package saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// CUSTOM REQUESTS
// ═══════════════════════════════════════

export function useCustomRequests(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-custom-requests', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_custom_requests')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertCustomRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_custom_requests')
        .upsert({ ...req, updated_at: new Date().toISOString() } as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-custom-requests'] });
      toast.success('Request updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
