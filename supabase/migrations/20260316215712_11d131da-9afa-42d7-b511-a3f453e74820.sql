
-- ═══════════════════════════════════════════════════════════════════
-- BRANDARO PHASE 3: CONVERSION ENGINE TABLES
-- ═══════════════════════════════════════════════════════════════════

-- Demo Sites generated for interested leads
CREATE TABLE public.brandaro_demo_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE NOT NULL,
  demo_url TEXT,
  screenshot_url TEXT,
  business_name TEXT NOT NULL,
  industry TEXT,
  city TEXT,
  state TEXT,
  services_inferred TEXT[],
  seo_text TEXT,
  generation_status TEXT NOT NULL DEFAULT 'pending' CHECK (generation_status IN ('pending','generating','ready','failed','expired')),
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivery_method TEXT CHECK (delivery_method IN ('sms','email','both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Demo engagement events (immutable tracking)
CREATE TABLE public.brandaro_demo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id UUID REFERENCES public.brandaro_demo_sites(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view','click','scroll','cta_click','time_on_page')),
  event_data JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proposals sent to prospects
CREATE TABLE public.brandaro_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE NOT NULL,
  demo_id UUID REFERENCES public.brandaro_demo_sites(id) ON DELETE SET NULL,
  tracking_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  proposal_url TEXT,
  package_tier TEXT NOT NULL DEFAULT 'starter' CHECK (package_tier IN ('starter','professional','premium','elite')),
  base_price NUMERIC(10,2) NOT NULL DEFAULT 750,
  addons JSONB DEFAULT '[]',
  total_price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','negotiation','accepted','rejected','expired')),
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Production website projects
CREATE TABLE public.brandaro_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE SET NULL,
  demo_id UUID REFERENCES public.brandaro_demo_sites(id) ON DELETE SET NULL,
  proposal_id UUID REFERENCES public.brandaro_proposals(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  package_tier TEXT NOT NULL DEFAULT 'starter',
  domain TEXT,
  hosting_status TEXT DEFAULT 'pending' CHECK (hosting_status IN ('pending','provisioning','active','suspended','cancelled')),
  ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending','issuing','active','expired','failed')),
  build_status TEXT NOT NULL DEFAULT 'onboarding' CHECK (build_status IN ('onboarding','content_gathering','design','draft_ready','client_review','revisions','final_approval','launched','maintenance')),
  assigned_builder UUID,
  assigned_ai_agent UUID,
  deadline TIMESTAMPTZ,
  launched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client subscriptions (maintenance/marketing)
CREATE TABLE public.brandaro_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.brandaro_projects(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('maintenance','seo','social_media','google_business','lead_gen','custom')),
  monthly_fee NUMERIC(10,2) NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','cancelled','past_due')),
  started_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Follow-up automation sequences
CREATE TABLE public.brandaro_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE NOT NULL,
  demo_id UUID REFERENCES public.brandaro_demo_sites(id) ON DELETE SET NULL,
  proposal_id UUID REFERENCES public.brandaro_proposals(id) ON DELETE SET NULL,
  sequence_step INTEGER NOT NULL DEFAULT 1,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms','email','call')),
  message_template TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','failed','cancelled','converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.brandaro_demo_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_demo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_followups ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can manage demo sites" ON public.brandaro_demo_sites FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage demo events" ON public.brandaro_demo_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage proposals" ON public.brandaro_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage projects" ON public.brandaro_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage subscriptions" ON public.brandaro_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage followups" ON public.brandaro_followups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index for fast demo lookups
CREATE INDEX idx_brandaro_demo_sites_lead ON public.brandaro_demo_sites(lead_id);
CREATE INDEX idx_brandaro_demo_events_demo ON public.brandaro_demo_events(demo_id);
CREATE INDEX idx_brandaro_proposals_lead ON public.brandaro_proposals(lead_id);
CREATE INDEX idx_brandaro_proposals_token ON public.brandaro_proposals(tracking_token);
CREATE INDEX idx_brandaro_projects_client ON public.brandaro_projects(client_id);
CREATE INDEX idx_brandaro_followups_scheduled ON public.brandaro_followups(scheduled_at) WHERE status = 'pending';
