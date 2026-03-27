import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Marketplace Listing Gate
 * Enforces: NO ONBOARDING = NO LISTING
 * 
 * Public marketplace queries ONLY return listings where:
 * 1. listing status = 'published'
 * 2. partner onboarding_complete = true
 * 3. partner is_verified = true
 * 4. partner profile_completeness >= 50%
 */

export interface UTPublicListing {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  listing_type: string;
  base_price: number | null;
  price_label: string | null;
  cover_image_url: string | null;
  gallery_urls: string[] | null;
  highlights: string[] | null;
  tags: string[] | null;
  event_types: string[] | null;
  capacity_min: number | null;
  capacity_max: number | null;
  location_city: string | null;
  location_state: string | null;
  is_featured: boolean | null;
  booking_count: number | null;
  view_count: number | null;
  ai_quality_score: number | null;
  published_at: string | null;
  partner: {
    id: string;
    business_name: string;
    category: string;
    avg_rating: number | null;
    total_reviews: number | null;
    cover_image_url: string | null;
    logo_url: string | null;
    address_city: string | null;
    address_state: string | null;
    years_in_business: number | null;
  };
}

export interface UTPublishGateResult {
  can_publish: boolean;
  onboarding_complete: boolean;
  is_verified: boolean;
  profile_completeness: number;
  missing: string[] | null;
}

/**
 * Fetch published marketplace listings (public-facing).
 * RLS + this hook enforce the gate: only verified, onboarded partners.
 */
export function useUTPublicListings(filters?: {
  category?: string;
  city?: string;
  search?: string;
  featured?: boolean;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['ut-public-listings', filters],
    queryFn: async () => {
      let query = (supabase.from('ut_listings') as any)
        .select(`
          id, title, subtitle, slug, description, category, subcategory,
          listing_type, base_price, price_label, cover_image_url, gallery_urls,
          highlights, tags, event_types, capacity_min, capacity_max,
          location_city, location_state, is_featured, booking_count, view_count,
          ai_quality_score, published_at,
          partner:ut_partners!inner(
            id, business_name, category, avg_rating, total_reviews,
            cover_image_url, logo_url, address_city, address_state, years_in_business
          )
        `)
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('ai_quality_score', { ascending: false, nullsFirst: false })
        .limit(filters?.limit || 50);

      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.city) query = query.ilike('location_city', `%${filters.city}%`);
      if (filters?.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      if (filters?.featured) query = query.eq('is_featured', true);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as UTPublicListing[];
    },
  });
}

/**
 * Check if a specific partner can publish listings.
 * Used in the Partner Portal before allowing publish actions.
 */
export function useUTPublishGate(partnerId?: string) {
  return useQuery({
    queryKey: ['ut-publish-gate', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ut_can_partner_publish' as any, {
        p_partner_id: partnerId,
      });
      if (error) throw error;
      return data as UTPublishGateResult;
    },
  });
}
