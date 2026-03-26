import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════
// RENTAL PROFILE
// ═══════════════════════════════════════

export function useRentalProfile(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-rental-profile', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      const { data, error } = await supabase
        .from('ut_partner_rental_profiles')
        .select('*')
        .eq('partner_id', partnerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });
}

export function useUpsertRentalProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_rental_profiles')
        .upsert({ ...profile, updated_at: new Date().toISOString() } as any, { onConflict: 'partner_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-rental-profile'] });
      toast.success('Rental profile saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// RENTAL ITEMS (advanced)
// ═══════════════════════════════════════

export function useRentalItemsAdvanced(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-rental-items-adv', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_rental_items')
        .select('*')
        .eq('partner_id', partnerId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertRentalItemAdvanced() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_rental_items')
        .upsert({ ...item, updated_at: new Date().toISOString() } as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-rental-items-adv'] });
      toast.success('Item saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useBulkInsertRentalItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Record<string, any>[]) => {
      const { data, error } = await supabase
        .from('ut_partner_rental_items')
        .insert(items as any[])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ut-rental-items-adv'] });
      toast.success(`${data?.length || 0} items imported`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// RENTAL ITEM MEDIA
// ═══════════════════════════════════════

export function useRentalItemMedia(itemId: string | undefined) {
  return useQuery({
    queryKey: ['ut-rental-item-media', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase
        .from('ut_partner_rental_item_media')
        .select('*')
        .eq('rental_item_id', itemId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!itemId,
  });
}

// ═══════════════════════════════════════
// RENTAL PACKAGES
// ═══════════════════════════════════════

export function useRentalPackagesAdvanced(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-rental-packages-adv', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_rental_packages')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertRentalPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pkg: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_rental_packages')
        .upsert(pkg as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-rental-packages-adv'] });
      toast.success('Package saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// RENTAL RESERVATIONS
// ═══════════════════════════════════════

export function useRentalReservations(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-rental-reservations', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_rental_reservations')
        .select('*, ut_partner_rental_items(item_name, category)')
        .order('reserved_from');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}
