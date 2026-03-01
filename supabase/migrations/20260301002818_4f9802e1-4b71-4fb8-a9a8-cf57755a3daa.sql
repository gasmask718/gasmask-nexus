
-- Messaging Campaigns table
CREATE TABLE public.messaging_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  mode TEXT NOT NULL DEFAULT 'manual_bulk' CHECK (mode IN ('manual_bulk', 'ai_campaign', 'cadence_followup')),
  name TEXT NOT NULL,
  script TEXT,
  ai_enabled BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'paused', 'completed', 'cancelled')),
  target_filter JSONB DEFAULT '{}'::jsonb,
  persona TEXT,
  throttle_per_minute INTEGER DEFAULT 50,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_targets INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  opt_out_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messaging Targets table
CREATE TABLE public.messaging_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.messaging_campaigns(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES public.store_master(id),
  phone TEXT NOT NULL,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'replied', 'opted_out')),
  personalized_message TEXT,
  sent_at TIMESTAMPTZ,
  reply_received BOOLEAN DEFAULT false,
  opt_out BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messaging Messages table
CREATE TABLE public.messaging_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.messaging_campaigns(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id),
  target_id UUID REFERENCES public.messaging_targets(id),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT false,
  twilio_sid TEXT,
  biztext_response JSONB,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'received')),
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.messaging_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_messages ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users with admin/owner roles
CREATE POLICY "Authenticated users can view messaging_campaigns"
  ON public.messaging_campaigns FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authorized users can insert messaging_campaigns"
  ON public.messaging_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authorized users can update messaging_campaigns"
  ON public.messaging_campaigns FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view messaging_targets"
  ON public.messaging_targets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authorized users can insert messaging_targets"
  ON public.messaging_targets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authorized users can update messaging_targets"
  ON public.messaging_targets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view messaging_messages"
  ON public.messaging_messages FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authorized users can insert messaging_messages"
  ON public.messaging_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_messaging_targets_campaign ON public.messaging_targets(campaign_id);
CREATE INDEX idx_messaging_targets_status ON public.messaging_targets(status);
CREATE INDEX idx_messaging_messages_campaign ON public.messaging_messages(campaign_id);
CREATE INDEX idx_messaging_messages_store ON public.messaging_messages(store_id);
CREATE INDEX idx_messaging_campaigns_status ON public.messaging_campaigns(status);
