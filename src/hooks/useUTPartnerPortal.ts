import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════
// PARTNER PROFILE
// ═══════════════════════════════════════

export function useCurrentPartner() {
  return useQuery({
    queryKey: ['ut-current-partner'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('ut_partners')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePartnerById(id: string | undefined) {
  return useQuery({
    queryKey: ['ut-partner', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('ut_partners')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useAllPartners() {
  return useQuery({
    queryKey: ['ut-all-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ut_partners')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpsertPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partner: Record<string, any>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const payload = { ...partner, user_id: user.id, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('ut_partners')
        .upsert(payload as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-current-partner'] });
      qc.invalidateQueries({ queryKey: ['ut-all-partners'] });
      toast.success('Partner profile saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// LISTINGS
// ═══════════════════════════════════════

export function usePartnerListings(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-listings', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_listings')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listing: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_listings')
        .upsert({ ...listing, updated_at: new Date().toISOString() } as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ut-listings'] });
      toast.success('Listing saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════

export function usePartnerServices(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-services', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_services')
        .select('*')
        .eq('partner_id', partnerId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (svc: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_services')
        .upsert(svc as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-services'] });
      toast.success('Service saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// MEDIA
// ═══════════════════════════════════════

export function usePartnerMedia(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-media', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_media')
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
// PACKAGES
// ═══════════════════════════════════════

export function usePartnerPackages(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-packages', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_packages')
        .select('*')
        .eq('partner_id', partnerId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

// ═══════════════════════════════════════
// BOOKINGS
// ═══════════════════════════════════════

export function usePartnerBookings(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-bookings', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_bookings')
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
// AVAILABILITY
// ═══════════════════════════════════════

export function usePartnerAvailability(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-availability', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_availability')
        .select('*')
        .eq('partner_id', partnerId)
        .order('date');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

// ═══════════════════════════════════════
// VENUE SPACES
// ═══════════════════════════════════════

export function useVenueSpaces(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-venue-spaces', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_venue_spaces')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertVenueSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (space: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_venue_spaces')
        .upsert(space, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-venue-spaces'] });
      toast.success('Space saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// RENTAL INVENTORY
// ═══════════════════════════════════════

export function useRentalInventory(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-rental-inventory', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_rental_inventory')
        .select('*')
        .eq('partner_id', partnerId)
        .order('item_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

export function useUpsertRentalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_rental_inventory')
        .upsert(item, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-rental-inventory'] });
      toast.success('Inventory item saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// CATERING MENUS
// ═══════════════════════════════════════

export function useCateringMenus(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-catering-menus', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_catering_menus')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}

// ═══════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════

export function usePartnerAnalytics(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-analytics', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('ut_partner_analytics')
        .select('*')
        .eq('partner_id', partnerId)
        .order('metric_date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });
}
