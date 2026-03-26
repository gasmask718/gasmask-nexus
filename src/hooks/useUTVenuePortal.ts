import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════
// VENUE PROFILE
// ═══════════════════════════════════════

export function useVenueProfile(partnerId: string | undefined) {
  return useQuery({
    queryKey: ['ut-venue-profile', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      const { data, error } = await supabase
        .from('ut_partner_venue_profiles')
        .select('*')
        .eq('partner_id', partnerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });
}

export function useUpsertVenueProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_venue_profiles')
        .upsert({ ...profile, updated_at: new Date().toISOString() } as any, { onConflict: 'partner_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-venue-profile'] });
      toast.success('Venue profile saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// VENUE SPACES
// ═══════════════════════════════════════

export function useVenueSpacesAdvanced(venueId: string | undefined) {
  return useQuery({
    queryKey: ['ut-venue-spaces-adv', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('ut_partner_venue_spaces')
        .select('*')
        .eq('venue_id', venueId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });
}

export function useUpsertVenueSpaceAdvanced() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (space: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_venue_spaces')
        .upsert(space as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-venue-spaces-adv'] });
      toast.success('Space saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// VENUE MEDIA
// ═══════════════════════════════════════

export function useVenueMedia(venueId: string | undefined) {
  return useQuery({
    queryKey: ['ut-venue-media', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('ut_partner_venue_media')
        .select('*')
        .eq('venue_id', venueId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });
}

export function useAddVenueMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (media: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_venue_media')
        .insert(media as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-venue-media'] });
      toast.success('Media added');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// VENUE AVAILABILITY
// ═══════════════════════════════════════

export function useVenueAvailability(venueId: string | undefined) {
  return useQuery({
    queryKey: ['ut-venue-availability', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('ut_partner_venue_availability')
        .select('*')
        .eq('venue_id', venueId)
        .order('available_date');
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });
}

export function useUpsertVenueAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (avail: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_venue_availability')
        .upsert(avail as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-venue-availability'] });
      toast.success('Availability updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ═══════════════════════════════════════
// VENUE PACKAGES
// ═══════════════════════════════════════

export function useVenuePackages(venueId: string | undefined) {
  return useQuery({
    queryKey: ['ut-venue-packages', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('ut_partner_venue_packages')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });
}

export function useUpsertVenuePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pkg: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ut_partner_venue_packages')
        .upsert(pkg as any, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-venue-packages'] });
      toast.success('Package saved');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
