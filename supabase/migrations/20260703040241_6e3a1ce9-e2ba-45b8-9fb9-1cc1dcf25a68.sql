
CREATE TABLE public.clipper_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  bio text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','rejected')),
  tier text DEFAULT 'starter' CHECK (tier IN ('starter','pro','elite')),
  total_views bigint DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  stripe_connect_id text,
  stripe_connect_onboarded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.clipper_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clipper_id uuid REFERENCES public.clipper_accounts(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok','instagram','youtube','twitter')),
  handle text NOT NULL,
  profile_url text,
  follower_count integer DEFAULT 0,
  phyllo_account_id text,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  connected_at timestamptz DEFAULT now(),
  UNIQUE(clipper_id, platform, handle)
);

CREATE TABLE public.clipper_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  dynasty_business text NOT NULL CHECK (dynasty_business IN ('gasmask','brandaro','toptier','uft','playboxxx','iclean','dynasty_connect','uben')),
  title text NOT NULL,
  description text,
  brief text,
  dos text,
  donts text,
  hashtags text[],
  raw_footage_url text,
  tracking_base_url text,
  base_rate_per_1k numeric NOT NULL DEFAULT 1.00,
  commission_rate numeric NOT NULL DEFAULT 5.00,
  status text DEFAULT 'active' CHECK (status IN ('draft','active','paused','completed')),
  start_date date,
  end_date date,
  total_clips integer DEFAULT 0,
  total_views bigint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.clipper_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clipper_id uuid REFERENCES public.clipper_accounts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.clipper_campaigns(id) ON DELETE CASCADE,
  tracking_link text UNIQUE,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','removed')),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(clipper_id, campaign_id)
);

CREATE TABLE public.clipper_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clipper_id uuid REFERENCES public.clipper_accounts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.clipper_campaigns(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.clipper_social_accounts(id),
  platform text NOT NULL,
  post_url text NOT NULL,
  post_id text,
  phyllo_content_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','flagged')),
  views bigint DEFAULT 0,
  likes bigint DEFAULT 0,
  shares bigint DEFAULT 0,
  comments bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  conversions integer DEFAULT 0,
  base_earnings numeric DEFAULT 0,
  conversion_earnings numeric DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  last_synced_at timestamptz,
  submitted_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

CREATE TABLE public.clipper_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clipper_id uuid REFERENCES public.clipper_accounts(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.clipper_submissions(id),
  campaign_id uuid REFERENCES public.clipper_campaigns(id),
  earning_type text CHECK (earning_type IN ('base_views','conversion','bonus','adjustment')),
  amount numeric NOT NULL,
  views_at_calculation bigint,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.clipper_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clipper_id uuid REFERENCES public.clipper_accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  stripe_transfer_id text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.clipper_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clipper_id uuid REFERENCES public.clipper_accounts(id),
  campaign_id uuid REFERENCES public.clipper_campaigns(id),
  submission_id uuid REFERENCES public.clipper_submissions(id),
  tracking_link text,
  converted_at timestamptz DEFAULT now(),
  order_value numeric,
  commission_amount numeric,
  stripe_payment_id text
);

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clipper_accounts TO authenticated;
GRANT INSERT ON public.clipper_accounts TO anon;
GRANT ALL ON public.clipper_accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clipper_social_accounts TO authenticated;
GRANT ALL ON public.clipper_social_accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clipper_campaigns TO authenticated;
GRANT ALL ON public.clipper_campaigns TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clipper_assignments TO authenticated;
GRANT ALL ON public.clipper_assignments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clipper_submissions TO authenticated;
GRANT ALL ON public.clipper_submissions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clipper_earnings TO authenticated;
GRANT ALL ON public.clipper_earnings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clipper_payouts TO authenticated;
GRANT ALL ON public.clipper_payouts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clipper_conversions TO authenticated;
GRANT ALL ON public.clipper_conversions TO service_role;

-- RLS
ALTER TABLE public.clipper_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipper_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipper_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipper_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipper_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipper_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipper_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipper_conversions ENABLE ROW LEVEL SECURITY;

-- Service role
CREATE POLICY ca_service ON public.clipper_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY csa_service ON public.clipper_social_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY cc_service ON public.clipper_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY casgn_service ON public.clipper_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY cs_service ON public.clipper_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY ce_service ON public.clipper_earnings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY cp_service ON public.clipper_payouts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY ccv_service ON public.clipper_conversions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Own data
CREATE POLICY ca_own ON public.clipper_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY csa_own ON public.clipper_social_accounts FOR ALL TO authenticated
  USING (clipper_id IN (SELECT id FROM public.clipper_accounts WHERE user_id = auth.uid()))
  WITH CHECK (clipper_id IN (SELECT id FROM public.clipper_accounts WHERE user_id = auth.uid()));
CREATE POLICY cs_own ON public.clipper_submissions FOR ALL TO authenticated
  USING (clipper_id IN (SELECT id FROM public.clipper_accounts WHERE user_id = auth.uid()))
  WITH CHECK (clipper_id IN (SELECT id FROM public.clipper_accounts WHERE user_id = auth.uid()));
CREATE POLICY ce_own ON public.clipper_earnings FOR SELECT TO authenticated
  USING (clipper_id IN (SELECT id FROM public.clipper_accounts WHERE user_id = auth.uid()));

-- Campaigns readable by auth
CREATE POLICY cc_read ON public.clipper_campaigns FOR SELECT TO authenticated USING (status = 'active');

-- Public applications
CREATE POLICY ca_insert ON public.clipper_accounts FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Seed 8 campaigns
INSERT INTO public.clipper_campaigns
(brand_name, dynasty_business, title, description, brief, dos, donts, hashtags, base_rate_per_1k, commission_rate, status)
VALUES
('GasMask Distribution','gasmask','GasMask Brand Awareness',
 'Create viral short-form content featuring GasMask tobacco and grabba products.',
 'Show the product naturally. Lifestyle content. NYC/urban vibe. Keep it authentic.',
 'Show product clearly. Use NYC locations. Keep energy high.',
 'No direct smoking on camera. No health claims. 21+ content only.',
 ARRAY['#gasmask','#grabba','#nyc','#dynastyos'], 2.00, 5.00, 'active'),
('Brandaro Digital','brandaro','Brandaro Web Agency Promos',
 'Showcase Brandaro AI web design services. B2B focus. Target small business owners.',
 'Show before/after websites. Highlight AI speed. Show results and ROI for clients.',
 'Use screen recordings. Show real results. Target entrepreneurs.',
 'No false claims. No competitor comparisons.',
 ARRAY['#brandaro','#webdesign','#ai','#smallbusiness'], 3.00, 12.00, 'active'),
('TopTier Experience','toptier','TopTier Luxury Content',
 'Luxury lifestyle content featuring TopTier transportation and concierge services.',
 'Film in luxury vehicles. Airport pickups. VIP experiences. Aspirational content.',
 'Show the lifestyle. Film inside vehicles. Highlight the service.',
 'No pricing in content. No competitors mentioned.',
 ARRAY['#toptier','#luxury','#vip','#nyc'], 4.00, 10.00, 'active'),
('Unforgettable Times','uft','UFT Event Marketplace Content',
 'Showcase UFT as the go-to platform for events, venues, and entertainment.',
 'Film at events. Show the energy. Highlight vendors and experiences.',
 'Capture event energy. Show happy people. Tag venues.',
 'No filming minors. Venue permission required.',
 ARRAY['#unforgettabletimes','#events','#nyc','#party'], 2.50, 8.00, 'active'),
('Playboxxx','playboxxx','Playboxxx Creator Platform',
 'Promote Playboxxx as the premium creator monetization platform. 18+ only.',
 'Target content creators. Show the earnings potential. Highlight platform features.',
 'Creator testimonials. Earnings screenshots. Platform UI walkthroughs.',
 'No explicit content in clips. 18+ audience targeting only.',
 ARRAY['#playboxxx','#creators','#onlyfans','#monetize'], 3.00, 12.00, 'active'),
('iClean WeClean','iclean','iClean Cleaning Services',
 'Showcase iClean WeClean residential and commercial cleaning services.',
 'Before and after cleaning content. Show the results. Clean NYC spaces.',
 'Dramatic before/afters. Time lapse cleaning. Spotless results.',
 'Get homeowner permission. No filming personal items.',
 ARRAY['#iclean','#cleaning','#nyc','#clean'], 1.50, 6.00, 'active'),
('Dynasty Connect','dynasty_connect','Dynasty Connect AI Services',
 'Promote Dynasty Connect AI call-center and business automation services.',
 'Target business owners. Show AI calling demos. Highlight ROI and time savings.',
 'Screen recordings of AI calls. Business owner testimonials. Show results.',
 'No recording real customer conversations. Comply with call recording laws.',
 ARRAY['#dynastyconnect','#ai','#automation','#business'], 2.50, 10.00, 'active'),
('UBEN','uben','UBEN Community Impact',
 'Showcase UBEN programs and community impact across NY/NJ.',
 'Authentic community stories. Program participant testimonials. Impact metrics.',
 'Real stories. Real people. Community locations. Authentic.',
 'Get participant consent. No minors without guardian consent.',
 ARRAY['#uben','#community','#nycnonprofit','#empowerment'], 1.00, 5.00, 'active');
