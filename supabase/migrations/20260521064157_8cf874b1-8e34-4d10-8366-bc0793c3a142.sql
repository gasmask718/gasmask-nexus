
CREATE TABLE public.tt_service_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  service_category text NOT NULL,
  partner_types text[] NOT NULL DEFAULT '{}',
  pricing_strategy text NOT NULL DEFAULT 'quote',
  fulfillment_model text NOT NULL DEFAULT 'manual',
  intake_table text NOT NULL DEFAULT 'tt_bookings',
  dedicated_tables text[] DEFAULT '{}',
  sms_template_key text,
  requires_authenticator boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tt_service_routing_slug ON public.tt_service_routing(slug);
CREATE INDEX idx_tt_service_routing_cat_active
  ON public.tt_service_routing(service_category, is_active);

ALTER TABLE public.tt_service_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tt_service_routing public read active"
ON public.tt_service_routing FOR SELECT
USING (is_active = true);

CREATE POLICY "tt_service_routing admin all"
ON public.tt_service_routing FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_tt_service_routing_updated_at
BEFORE UPDATE ON public.tt_service_routing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tt_bookings
  ADD COLUMN IF NOT EXISTS service_slug text;

INSERT INTO public.tt_service_routing
  (slug, display_name, service_category, partner_types, pricing_strategy, fulfillment_model, dedicated_tables, is_active, sort_order) VALUES
('black-truck',  'Black Truck / Car Service', 'luxury_transport', ARRAY['chauffeur','sedan','suv'],         'distance','auto_dispatch',       ARRAY['tt_vehicles'], true, 10),
('exotic-cars',  'Exotic Car Rentals',        'exotic_rental',    ARRAY['exotic_supplier'],                 'tiered','auto_dispatch',         ARRAY['tt_vehicles'], true, 20),
('sprinters',    'Sprinter Vans',             'luxury_transport', ARRAY['sprinter_operator'],               'distance','auto_dispatch',       ARRAY['tt_vehicles'], true, 30),
('party-bus',    'Party Bus',                 'group_transport',  ARRAY['party_bus_operator'],              'tiered','auto_dispatch',         '{}',                  true, 40),
('private-jet',  'Private Jet',               'private_jet',      ARRAY['aviation_broker'],                 'quote','quote_then_dispatch',    ARRAY['tt_private_jets'], true, 50),
('yachts',       'Yacht Charter',             'yacht_charter',    ARRAY['yacht_operator'],                  'quote','quote_then_dispatch',    '{}',                  true, 60),
('helicopter',   'Helicopter',                'helicopter',       ARRAY['helicopter_operator'],             'quote','quote_then_dispatch',    '{}',                  true, 70),
('coach-bus',    'Coach Bus',                 'coach_bus',        ARRAY['coach_operator'],                  'tiered','auto_dispatch',         '{}',                  true, 80),
('jetski',       'Jet Ski',                   'watercraft_rental',ARRAY['watercraft_operator'],             'fixed','auto_dispatch',          '{}',                  true, 90),
('slingshot',    'Slingshot',                 'novelty_rental',   ARRAY['novelty_operator'],                'fixed','auto_dispatch',          '{}',                  true, 100),
('club',         'Nightclub VIP',             'nightlife_vip',    ARRAY['nightlife_host'],                  'quote','manual',                 '{}',                  true, 110),
('restaurant',   'Restaurant Reservations',   'dining_reservation',ARRAY['restaurant_partner'],             'quote','manual',                 '{}',                  true, 120),
('event-spaces', 'Event Spaces',              'event_space',      ARRAY['venue_partner'],                   'quote','quote_then_dispatch',    '{}',                  true, 130),
('security',     'Security Detail',           'security_detail',  ARRAY['security_provider'],               'quote','auto_dispatch',          '{}',                  true, 140),
('media',        'Media / Photo / Video',     'media_production', ARRAY['photographer','videographer'],     'tiered','auto_dispatch',         '{}',                  true, 150),
('corporate',    'Corporate Events',          'corporate_event',  ARRAY['corporate_planner'],               'quote','manual',                 ARRAY['tt_corporate_accounts'], true, 160),
('kids-family',  'Kids & Family Experiences', 'family_experience',ARRAY['experience_host'],                 'catalog','manual',               ARRAY['tt_experiences'], true, 170),
('activities',   'Activities',                'experience_booking',ARRAY['experience_host'],                'catalog','manual',               ARRAY['tt_experiences'], true, 180),
('things-to-do', 'Things To Do',              'experience_booking',ARRAY['experience_host'],                'catalog','manual',               ARRAY['tt_experiences'], true, 190),
('beauty',       'Beauty Services',           'beauty_services',  ARRAY['beauty_pro'],                      'tiered','auto_dispatch',         '{}',                  true, 200),
('spa-wellness', 'Spa & Wellness',            'wellness',         ARRAY['wellness_pro'],                    'tiered','auto_dispatch',         '{}',                  true, 210),
('massage',      'Massage',                   'wellness',         ARRAY['massage_therapist'],               'tiered','auto_dispatch',         '{}',                  true, 220),
('chef',         'Private Chef',              'private_chef',     ARRAY['chef'],                            'quote','auto_dispatch',          '{}',                  true, 230),
('hotels',       'Hotels',                    'hotel_booking',    ARRAY['hotel_supplier'],                  'catalog','quote_then_dispatch',  ARRAY['tt_hotels','tt_hotel_room_offers','tt_hotel_addons'], true, 240),
('roses',        'Roses & Floral Gifting',    'roses_gifting',    ARRAY['florist'],                         'fixed','auto_dispatch',          '{}',                  true, 250),
('art-gallery',  'Art Gallery Concierge',     'art_concierge',    ARRAY['art_dealer'],                      'quote','manual',                 '{}',                  true, 260),
('jewelry',      'Jewelry Concierge',         'jewelry_concierge',ARRAY['jeweler'],                         'quote','manual',                 '{}',                  true, 270),
('luxury-gifting','Luxury Gifting',           'gifting',          ARRAY['gift_concierge'],                  'tiered','manual',                '{}',                  true, 280),
('hotel-decor',  'Hotel Decor',               'decor',            ARRAY['decorator'],                       'tiered','quote_then_dispatch',   '{}',                  false, 290),
('truck-decor',  'Truck Decor',               'decor',            ARRAY['decorator'],                       'tiered','quote_then_dispatch',   '{}',                  false, 300);
