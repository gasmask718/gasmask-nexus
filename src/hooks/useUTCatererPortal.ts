import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════
// FOOD & BEVERAGE PROFILE
// ═══════════════════════════════════════

export function useFoodProfile(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-food-profile', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      const { data, error } = await supabase
        .from('ut_partner_food_profiles')
        .select('*')
        .eq('partner_id', partnerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });
}

export function useUpsertFoodProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_food_profiles')
        .upsert({ ...profile, updated_at: new Date().toISOString() } as any, { onConflict: 'partner_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-food-profile'] });
      toast.success('Food profile saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// MENUS
// ═══════════════════════════════════════

export function usePartnerMenus(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-partner-menus', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_menus')
        .select('*')
        .eq('partner_id', partnerId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (menu: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_menus')
        .upsert({ ...menu, updated_at: new Date().toISOString() } as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-partner-menus'] });
      toast.success('Menu saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// MENU ITEMS
// ═══════════════════════════════════════

export function useMenuItems(menuId: string | undefined) {
  return useQuery({
    queryKey: ['ut-menu-items', menuId],
    queryFn: async () => {
      if (!menuId) return [];
      const { data, error } = await supabase
        .from('ut_partner_menu_items')
        .select('*')
        .eq('menu_id', menuId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!menuId,
  });
}

export function useUpsertMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_menu_items')
        .upsert(item as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-menu-items'] });
      toast.success('Menu item saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// SERVICE PACKAGES
// ═══════════════════════════════════════

export function useServicePackages(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-service-packages', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_service_packages')
        .select('*')
        .eq('partner_id', partnerId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertServicePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pkg: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_service_packages')
        .upsert({ ...pkg, updated_at: new Date().toISOString() } as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-service-packages'] });
      toast.success('Package saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// FOOD MEDIA
// ═══════════════════════════════════════

export function useFoodMedia(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-food-media', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_food_media')
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
// FOOD AVAILABILITY
// ═══════════════════════════════════════

export function useFoodAvailability(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-food-availability', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_food_availability')
        .select('*')
        .eq('partner_id', partnerId)
        .order('available_date');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}
