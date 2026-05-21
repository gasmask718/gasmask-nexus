
# Universal Service Router — Plan & Diffs (PRE-DEPLOY)

Nothing below is applied yet. Approve and I will run the migration, write the files, and deploy the 3 functions. No unrelated code will be touched.

Scope of file changes:
- NEW migration: `tt_service_routing` table + RLS + trigger + 30 seed rows
- NEW file: `supabase/functions/_shared/serviceRouter.ts`
- EDIT: `supabase/functions/create-tt-booking/index.ts`
- EDIT: `supabase/functions/receive-public-booking/index.ts`
- EDIT: `supabase/functions/tt-smart-dispatch/index.ts`

No other functions, no UI, no public site, no standalone backend.

---

## STEP 1 — Migration SQL

```sql
-- 1. Routing table
CREATE TABLE public.tt_service_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  service_category text NOT NULL,
  partner_types text[] NOT NULL DEFAULT '{}',
  pricing_strategy text NOT NULL DEFAULT 'quote',      -- distance|fixed|tiered|quote|catalog
  fulfillment_model text NOT NULL DEFAULT 'manual',    -- auto_dispatch|manual|quote_then_dispatch|catalog_order
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

-- Public can read active rows (needed for public site / unauth intake)
CREATE POLICY "tt_service_routing public read active"
ON public.tt_service_routing FOR SELECT
USING (is_active = true);

-- Admins full access (relies on existing has_role(...,'admin'))
CREATE POLICY "tt_service_routing admin all"
ON public.tt_service_routing FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger (reuses existing public.update_updated_at_column)
CREATE TRIGGER trg_tt_service_routing_updated_at
BEFORE UPDATE ON public.tt_service_routing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

## STEP 2 — Seed (30 slugs)

```sql
INSERT INTO public.tt_service_routing
  (slug, display_name, service_category, partner_types, pricing_strategy, fulfillment_model, dedicated_tables, is_active, sort_order) VALUES
-- Transportation
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
-- Entertainment
('club',         'Nightclub VIP',             'nightlife_vip',    ARRAY['nightlife_host'],                  'quote','manual',                 '{}',                  true, 110),
('restaurant',   'Restaurant Reservations',   'dining_reservation',ARRAY['restaurant_partner'],             'quote','manual',                 '{}',                  true, 120),
('event-spaces', 'Event Spaces',              'event_space',      ARRAY['venue_partner'],                   'quote','quote_then_dispatch',    '{}',                  true, 130),
('security',     'Security Detail',           'security_detail',  ARRAY['security_provider'],               'quote','auto_dispatch',          '{}',                  true, 140),
('media',        'Media / Photo / Video',     'media_production', ARRAY['photographer','videographer'],     'tiered','auto_dispatch',         '{}',                  true, 150),
('corporate',    'Corporate Events',          'corporate_event',  ARRAY['corporate_planner'],               'quote','manual',                 ARRAY['tt_corporate_accounts'], true, 160),
('kids-family',  'Kids & Family Experiences', 'family_experience',ARRAY['experience_host'],                 'catalog','manual',               ARRAY['tt_experiences'], true, 170),
('activities',   'Activities',                'experience_booking',ARRAY['experience_host'],                'catalog','manual',               ARRAY['tt_experiences'], true, 180),
('things-to-do', 'Things To Do',              'experience_booking',ARRAY['experience_host'],                'catalog','manual',               ARRAY['tt_experiences'], true, 190),
-- Lifestyle
('beauty',       'Beauty Services',           'beauty_services',  ARRAY['beauty_pro'],                      'tiered','auto_dispatch',         '{}',                  true, 200),
('spa-wellness', 'Spa & Wellness',            'wellness',         ARRAY['wellness_pro'],                    'tiered','auto_dispatch',         '{}',                  true, 210),
('massage',      'Massage',                   'wellness',         ARRAY['massage_therapist'],               'tiered','auto_dispatch',         '{}',                  true, 220),
('chef',         'Private Chef',              'private_chef',     ARRAY['chef'],                            'quote','auto_dispatch',          '{}',                  true, 230),
('hotels',       'Hotels',                    'hotel_booking',    ARRAY['hotel_supplier'],                  'catalog','quote_then_dispatch',  ARRAY['tt_hotels','tt_hotel_room_offers','tt_hotel_addons'], true, 240),
('roses',        'Roses & Floral Gifting',    'roses_gifting',    ARRAY['florist'],                         'fixed','auto_dispatch',          '{}',                  true, 250),
('art-gallery',  'Art Gallery Concierge',     'art_concierge',    ARRAY['art_dealer'],                      'quote','manual',                 '{}',                  true, 260),
('jewelry',      'Jewelry Concierge',         'jewelry_concierge',ARRAY['jeweler'],                         'quote','manual',                 '{}',                  true, 270),
('luxury-gifting','Luxury Gifting',           'gifting',          ARRAY['gift_concierge'],                  'tiered','manual',                '{}',                  true, 280),
-- Decor (subsystem not yet built — inactive)
('hotel-decor',  'Hotel Decor',               'decor',            ARRAY['decorator'],                       'tiered','quote_then_dispatch',   '{}',                  false, 290),
('truck-decor',  'Truck Decor',               'decor',            ARRAY['decorator'],                       'tiered','quote_then_dispatch',   '{}',                  false, 300);
```

## STEP 3 — `supabase/functions/_shared/serviceRouter.ts` (new)

```ts
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

  // Unrouted fallback — never throw
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
```

## STEP 4 — Diff: `create-tt-booking/index.ts`

Add import + resolve routing + write resolved fields. Hard-coded `service_type` / `service_name` removed; if unrouted, status flips to `needs_review` and an admin alert is logged.

```diff
 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
 import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'
+import { resolveRouting } from '../_shared/serviceRouter.ts'
@@
-    const body = await req.json();
-    const { customer_name, customer_email, customer_phone, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, pickup_datetime, vehicle_id, passenger_count, add_ons, special_requests, stripe_payment_intent_id, total_price } = body;
+    const body = await req.json();
+    const { customer_name, customer_email, customer_phone, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, pickup_datetime, vehicle_id, passenger_count, add_ons, special_requests, stripe_payment_intent_id, total_price, service_slug, service_type: incomingServiceType } = body;
@@
-    const booking_reference = generateBookingRef();
-
-    // Insert booking
-    const { data: booking, error: bookingErr } = await supabase.from('tt_bookings').insert({
+    const booking_reference = generateBookingRef();
+
+    // Resolve routing from slug / legacy service_type (defaults to black-truck for back-compat)
+    const routing = await resolveRouting(supabase, service_slug || incomingServiceType || 'black-truck');
+    const initialStatus = routing._unrouted ? 'needs_review' : 'confirmed';
+
+    // Insert booking
+    const { data: booking, error: bookingErr } = await supabase.from('tt_bookings').insert({
       client_name: customer_name,
       client_email: customer_email,
       client_phone: customer_phone,
-      service_type: 'luxury_transport',
-      service_name: 'Black Car Service',
+      service_type: routing.service_category,
+      service_name: routing.display_name,
+      service_slug: routing.slug,
+      fulfillment_model: routing.fulfillment_model,
       total_price,
-      status: 'confirmed',
+      status: initialStatus,
       payment_status: 'paid',
@@
     if (bookingErr) throw bookingErr;
+
+    if (routing._unrouted) {
+      await supabase.from('tt_notifications_log').insert({
+        booking_id: booking.id,
+        type: 'unrouted_booking_alert',
+        channel: 'internal',
+        recipient: 'admin',
+        message: `Unrouted service "${service_slug || incomingServiceType}" — booking ${booking_reference} needs review`,
+        status: 'sent',
+      });
+    }
```

Note: `service_slug` column does not exist yet on `tt_bookings`. I'll add it in the same migration:
```sql
ALTER TABLE public.tt_bookings
  ADD COLUMN IF NOT EXISTS service_slug text;
```
(`fulfillment_model` already exists per `receive-public-booking`.)

## STEP 5 — Diff: `receive-public-booking/index.ts`

```diff
 import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
+import { resolveRouting } from "../_shared/serviceRouter.ts"
@@
-    const booking_reference = 'TT-' + (local_booking_id || '').slice(0, 8).toUpperCase()
+    const booking_reference = 'TT-' + (local_booking_id || '').slice(0, 8).toUpperCase()
+    const routing = await resolveRouting(supabase, service_type)
+    const status = routing._unrouted ? 'needs_review' : 'pending'

     const { data: osBooking, error } = await supabase
       .from('tt_bookings')
       .insert({
         client_name: customer_name || 'Website Inquiry',
         client_email: customer_email || null,
         client_phone: customer_phone || null,
-        service_type: service_type || 'general',
-        service_name: service_name || service_type || 'Website Booking',
+        service_type: routing.service_category,
+        service_name: service_name || routing.display_name,
+        service_slug: routing.slug,
         pickup_location: pickup_location || null,
         dropoff_location: dropoff_location || null,
         scheduled_at: scheduled_at || null,
         total_price: total_price || 0,
-        status: 'pending',
+        status,
         payment_status: 'unpaid',
         booking_reference: booking_reference,
-        fulfillment_model: 'quote_broadcast',
+        fulfillment_model: routing.fulfillment_model,
         special_requests: special_requests || null,
         source: 'public_website',
         notes: metadata ? JSON.stringify(metadata) : null,
       })
@@
     if (error) throw error
+
+    if (routing._unrouted) {
+      await supabase.from('tt_notifications_log').insert({
+        booking_id: osBooking.id,
+        type: 'unrouted_booking_alert',
+        channel: 'internal',
+        recipient: 'admin',
+        message: `Unrouted public service "${service_type}" — ${booking_reference} needs review`,
+        status: 'sent',
+      })
+    }
@@
-    // Auto-trigger smart dispatch
-    try {
+    // Auto-trigger smart dispatch only for auto_dispatch / quote_then_dispatch
+    const shouldDispatch = !routing._unrouted &&
+      (routing.fulfillment_model === 'auto_dispatch' ||
+       routing.fulfillment_model === 'quote_then_dispatch')
+    if (shouldDispatch) try {
       const dispatchRes = await supabase.functions.invoke(
         'tt-smart-dispatch',
         { body: { booking_id: osBooking.id } }
       )
       console.log('Auto-dispatch result:', dispatchRes.data)
     } catch (dispatchErr) {
       console.error('Auto-dispatch failed (non-critical):', dispatchErr)
     }
```

## STEP 6 — Diff: `tt-smart-dispatch/index.ts`

Replace hard-coded `serviceTypeMap` with `resolveRouting`. Manual / unrouted bookings go to `tt_dispatch_requests` as a routed lead and fire an admin alert — they do NOT broadcast to partners. Coach-bus + media keep their existing engines because their routing rows resolve to `auto_dispatch` with the partner_types those engines already use (no engine-specific code is removed here).

```diff
 import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
+import { resolveRouting } from "../_shared/serviceRouter.ts"
@@
 const PUBLIC_URL = 'https://hruhkyvwtfpfviwnvhne.supabase.co'
-
-// Maps booking service_type to values found in partner service_types array
-const serviceTypeMap: Record<string, string[]> = {
-  luxury_transport: ['chauffeur', 'sprinter', 'sedan', 'suv', 'limo'],
-  exotic_rental: ['exotic', 'rental', 'supercar'],
-  helicopter: ['helicopter', 'aviation'],
-  private_jet: ['jet', 'aviation', 'private_jet'],
-  yacht_charter: ['yacht', 'marine', 'vessel'],
-  private_chef: ['chef', 'culinary', 'catering'],
-  nightlife_vip: ['nightlife', 'vip', 'bottle'],
-  wellness_massage: ['massage', 'wellness', 'spa'],
-  beauty_services: ['beauty', 'styling', 'glam'],
-  media_production: ['photographer', 'videographer', 'media', 'photography'],
-  security_detail: ['security', 'protection'],
-  event_space: ['venue', 'events', 'space'],
-}
@@
-    const serviceCategory = booking.service_type || 'luxury_transport'
-    const matchServiceTypes = serviceTypeMap[serviceCategory] || [serviceCategory]
+    const routing = await resolveRouting(supabase, booking.service_slug || booking.service_type)
+    const serviceCategory = routing.service_category
+    const matchServiceTypes = routing.partner_types
+
+    // Manual or unrouted: do not broadcast. Create routed lead + admin alert.
+    if (routing._unrouted || routing.fulfillment_model === 'manual' || matchServiceTypes.length === 0) {
+      await supabase.from('tt_dispatch_requests').insert({
+        booking_id: booking.id,
+        booking_reference: booking.booking_reference,
+        service_type: booking.service_type,
+        service_category: serviceCategory,
+        pickup_location: booking.pickup_location,
+        dropoff_location: booking.dropoff_location,
+        scheduled_at: booking.scheduled_at,
+        customer_name: booking.client_name,
+        customer_phone: booking.client_phone,
+        special_requests: booking.special_requests,
+        total_price: booking.total_price,
+        status: routing._unrouted ? 'needs_review' : 'manual_queue',
+        matched_partners: [],
+        auto_matched: false,
+      })
+      await supabase.from('tt_notifications_log').insert({
+        booking_id: booking.id,
+        type: routing._unrouted ? 'unrouted_booking_alert' : 'manual_dispatch_required',
+        channel: 'internal',
+        recipient: 'admin',
+        message: `${routing.display_name} booking ${booking.booking_reference} requires manual handling`,
+        status: 'sent',
+      })
+      return new Response(JSON.stringify({
+        success: true, matched: 0,
+        fulfillment_model: routing.fulfillment_model,
+        unrouted: !!routing._unrouted,
+        message: 'Routed to manual queue',
+      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
+    }
@@
     const { data: publicPartners, error: partnerErr } = await publicClient
       .from('partners')
       .select('id, user_id, partner_type, business_name, status, service_types, markets, rating, average_response_minutes, is_active, capabilities, phone, contact_info, contact_phone, trust_score')
       .eq('status', 'approved')
       .eq('is_active', true)
       .overlaps('service_types', matchServiceTypes)
```

Rest of the dispatch / scoring / SMS path is unchanged.

---

## STEP 7 — Verification (run after deploy)

I will then report a table with:

| Check | Expected | Result |
|---|---|---|
| 30 rows in `tt_service_routing` | count = 30 | tbd |
| `exotic-cars` resolve | category=exotic_rental, partners=[exotic_supplier], model=auto_dispatch | tbd |
| `yachts` resolve | yacht_charter / [yacht_operator] / quote_then_dispatch | tbd |
| `chef` resolve | private_chef / [chef] / auto_dispatch | tbd |
| `roses` resolve | roses_gifting / [florist] / auto_dispatch | tbd |
| `jewelry` resolve | jewelry_concierge / [jeweler] / manual | tbd |
| Unknown slug `foo-bar` | `_unrouted=true`, booking status `needs_review`, admin alert logged | tbd |
| `coach-bus` resolve | coach_bus / [coach_operator] / auto_dispatch — cb_* engine untouched | tbd |
| `media` resolve | media_production / [photographer,videographer] / auto_dispatch — media_dispatch_* untouched | tbd |

---

## What I will NOT change
- public site, standalone backend, any other edge function
- `tt_bookings` schema beyond adding `service_slug text` (nullable, additive)
- scoring logic, SMS gateway, partner query against the public site
- coach-bus (`cb_*`) and media (`media_dispatch_*`) engines

Approve and I'll run the migration, write the three function files + the shared router, deploy, then post the verification table.
