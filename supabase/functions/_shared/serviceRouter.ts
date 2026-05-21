// Shared service routing resolver for TopTier intake + dispatch.
// Never throws — unknown slugs return { _unrouted: true } so booking is still
// captured and an admin alert can fire, instead of silently becoming 'general'.

export interface RoutingRow {
  id?: string;
  slug: string;
  display_name: string;
  service_category: string;
  partner_types: string[];
  pricing_strategy: string;
  fulfillment_model: string;
  intake_table: string;
  dedicated_tables: string[];
  sms_template_key?: string | null;
  requires_authenticator?: boolean;
  is_active?: boolean;
  _unrouted?: boolean;
}

// Legacy / alias map: old service_type strings -> canonical slug
const ALIAS_TO_SLUG: Record<string, string> = {
  luxury_transport: 'black-truck',
  black_car: 'black-truck',
  exotic: 'exotic-cars',
  exotic_rental: 'exotic-cars',
  sprinter: 'sprinters',
  party_bus: 'party-bus',
  private_jet: 'private-jet',
  jet: 'private-jet',
  yacht: 'yachts',
  yacht_charter: 'yachts',
  coach_bus: 'coach-bus',
  watercraft_rental: 'jetski',
  novelty_rental: 'slingshot',
  nightlife_vip: 'club',
  dining_reservation: 'restaurant',
  event_space: 'event-spaces',
  security_detail: 'security',
  media_production: 'media',
  corporate_event: 'corporate',
  family_experience: 'kids-family',
  experience_booking: 'activities',
  beauty_services: 'beauty',
  wellness: 'spa-wellness',
  wellness_massage: 'massage',
  private_chef: 'chef',
  hotel_booking: 'hotels',
  roses_gifting: 'roses',
  art_concierge: 'art-gallery',
  jewelry_concierge: 'jewelry',
  gifting: 'luxury-gifting',
};

export async function resolveRouting(
  supabase: any,
  slugOrServiceType: string | null | undefined
): Promise<RoutingRow> {
  const raw = (slugOrServiceType || '').trim();
  const candidate = raw.toLowerCase();
  const slug = ALIAS_TO_SLUG[candidate] || candidate;

  if (slug) {
    const { data } = await supabase
      .from('tt_service_routing')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (data) return data as RoutingRow;
  }

  return {
    slug: raw || 'unknown',
    display_name: raw || 'Unrouted Inquiry',
    service_category: 'unrouted',
    partner_types: [],
    pricing_strategy: 'quote',
    fulfillment_model: 'manual',
    intake_table: 'tt_bookings',
    dedicated_tables: [],
    _unrouted: true,
  };
}
