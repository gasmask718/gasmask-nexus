-- Phase 21: Real Estate Monetization & Automation

-- Investor Subscriptions
CREATE TABLE IF NOT EXISTS public.investor_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES public.investor_buy_boxes(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('standard', 'gold', 'institutional_vip')),
  monthly_fee NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investor_subscriptions_investor ON public.investor_subscriptions(investor_id);
CREATE INDEX idx_investor_subscriptions_active ON public.investor_subscriptions(active);

-- Follow-up Sequences
CREATE TABLE IF NOT EXISTS public.follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Follow-up Logs
CREATE TABLE IF NOT EXISTS public.follow_up_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES public.follow_up_sequences(id) ON DELETE SET NULL,
  step_number INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'voice', 'mail')),
  message_sent TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_received TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'no_response')),
  next_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_follow_up_logs_lead ON public.follow_up_logs(lead_id);
CREATE INDEX idx_follow_up_logs_sent ON public.follow_up_logs(sent_at);

-- E-Sign Documents
CREATE TABLE IF NOT EXISTS public.esign_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  acquisition_id UUID REFERENCES public.acquisitions_pipeline(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('purchase_agreement', 'assignment_contract', 'loi', 'addendum', 'disclosure')),
  pdf_url TEXT,
  signed_url TEXT,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_phone TEXT,
  signer_ip TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined', 'expired')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  secure_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_esign_documents_lead ON public.esign_documents(lead_id);
CREATE INDEX idx_esign_documents_status ON public.esign_documents(status);
CREATE INDEX idx_esign_documents_token ON public.esign_documents(secure_token);

-- Closing Partners
CREATE TABLE IF NOT EXISTS public.closing_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('title_company', 'attorney', 'closing_agent', 'escrow')),
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  states_served TEXT[] NOT NULL DEFAULT '{}',
  wholesale_friendly BOOLEAN NOT NULL DEFAULT false,
  average_close_days INTEGER,
  fees_range TEXT,
  rating NUMERIC CHECK (rating >= 0 AND rating <= 5),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_closing_partners_state ON public.closing_partners(state);
CREATE INDEX idx_closing_partners_active ON public.closing_partners(is_active);

-- Assigned Closing Partners
CREATE TABLE IF NOT EXISTS public.assigned_closing_partner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id UUID NOT NULL REFERENCES public.acquisitions_pipeline(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.closing_partners(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assigned_closing_partner_acquisition ON public.assigned_closing_partner(acquisition_id);
CREATE INDEX idx_assigned_closing_partner_partner ON public.assigned_closing_partner(partner_id);

-- Real Estate Notifications
CREATE TABLE IF NOT EXISTS public.real_estate_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('new_motivated_seller', 'comps_completed', 'offer_accepted', 'contract_signed', 'buyer_assigned', 'closing_complete', 'wire_received', 'follow_up_required')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'acquisition', 'investor_order', 'closing')),
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_real_estate_notifications_user ON public.real_estate_notifications(user_id);
CREATE INDEX idx_real_estate_notifications_read ON public.real_estate_notifications(read);
CREATE INDEX idx_real_estate_notifications_created ON public.real_estate_notifications(created_at DESC);

-- Mass Offer Campaign Tracking
CREATE TABLE IF NOT EXISTS public.mass_offer_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  offer_formula JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mass_offer_campaigns_status ON public.mass_offer_campaigns(status);

-- RLS Policies
ALTER TABLE public.investor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_closing_partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mass_offer_campaigns ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins manage investor subscriptions" ON public.investor_subscriptions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage follow-up sequences" ON public.follow_up_sequences FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage follow-up logs" ON public.follow_up_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage esign documents" ON public.esign_documents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage closing partners" ON public.closing_partners FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage assigned closing partners" ON public.assigned_closing_partner FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view their notifications" ON public.real_estate_notifications FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users update their notifications" ON public.real_estate_notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System creates notifications" ON public.real_estate_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage campaigns" ON public.mass_offer_campaigns FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));