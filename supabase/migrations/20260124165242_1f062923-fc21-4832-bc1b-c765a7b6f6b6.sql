-- PART 1: Create all missing tables (without realtime)

-- 1. Add missing columns to outbound_campaigns
ALTER TABLE public.outbound_campaigns 
ADD COLUMN IF NOT EXISTS executive_policy_id UUID REFERENCES public.executive_policies(id),
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id),
ADD COLUMN IF NOT EXISTS target_segment JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS jurisdiction_scope TEXT[] DEFAULT ARRAY['US'],
ADD COLUMN IF NOT EXISTS allowed_playbooks UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS human_escalation_rules JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS calls_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS interests_captured INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follow_ups_scheduled INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS objections_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentinel_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS containment_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS launched_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. CAMPAIGN TYPES DEFINITIONS
CREATE TABLE IF NOT EXISTS public.outbound_campaign_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code TEXT NOT NULL UNIQUE,
  type_name TEXT NOT NULL,
  description TEXT,
  allowed_outcomes TEXT[] NOT NULL DEFAULT '{}',
  forbidden_actions TEXT[] NOT NULL DEFAULT '{}',
  requires_policy BOOLEAN DEFAULT true,
  requires_playbook BOOLEAN DEFAULT true,
  requires_sentinel BOOLEAN DEFAULT true,
  default_max_calls_per_day INTEGER DEFAULT 100,
  default_cooldown_days INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.outbound_campaign_types (type_code, type_name, description, allowed_outcomes, forbidden_actions) VALUES
  ('product_launch', 'Product Launch - Store Outreach', 'Introduce new products to existing or prospect stores', 
   ARRAY['interest_captured', 'follow_up_scheduled', 'human_handoff', 'demo_booked', 'order_placed'],
   ARRAY['price_negotiation_beyond_approved', 'contractual_commitments', 'exclusivity_promises', 'unauthorized_discounts']),
  ('vendor_recruitment', 'Marketplace Growth - Vendor Recruitment', 'Recruit event halls, rental companies, service providers for marketplace',
   ARRAY['platform_explained', 'website_signup_invited', 'demo_booked', 'onboarding_scheduled', 'interest_captured'],
   ARRAY['revenue_guarantees', 'exclusivity_claims', 'legal_representations', 'misrepresent_affiliation']),
  ('marketplace_growth', 'Marketplace Growth - Unforgettable Times', 'Expand marketplace presence with venues and suppliers',
   ARRAY['listing_invited', 'benefits_explained', 'demo_booked', 'contact_captured'],
   ARRAY['revenue_guarantees', 'exclusivity_claims', 'legal_representations']),
  ('store_reactivation', 'Store Reactivation', 'Re-engage dormant or lapsed store customers',
   ARRAY['interest_recaptured', 'follow_up_scheduled', 'special_offer_presented', 'feedback_collected'],
   ARRAY['unauthorized_discounts', 'false_urgency', 'misrepresentation']),
  ('b2b_outreach', 'B2B General Outreach', 'General business-to-business outreach campaigns',
   ARRAY['interest_captured', 'meeting_scheduled', 'information_sent', 'human_handoff'],
   ARRAY['consumer_calls', 'spam_behavior', 'misrepresentation'])
ON CONFLICT (type_code) DO NOTHING;

-- 3. CAMPAIGN CALL FRAMES
CREATE TABLE IF NOT EXISTS public.campaign_call_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  campaign_run_id UUID REFERENCES public.campaign_runs(id),
  call_session_id UUID,
  target_phone TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  call_status TEXT NOT NULL DEFAULT 'queued',
  call_outcome TEXT,
  duration_seconds INTEGER,
  playbook_used_id UUID,
  style_profile_used_id UUID,
  confidence_score NUMERIC(5,4),
  sentiment_detected TEXT,
  intent_detected TEXT,
  ai_disclosure_spoken BOOLEAN DEFAULT false,
  disclaimers_spoken TEXT[] DEFAULT '{}',
  compliance_score NUMERIC(5,2),
  compliance_flags TEXT[] DEFAULT '{}',
  objections_raised TEXT[] DEFAULT '{}',
  interest_captured BOOLEAN DEFAULT false,
  follow_up_scheduled BOOLEAN DEFAULT false,
  escalated_to_human BOOLEAN DEFAULT false,
  opt_out_requested BOOLEAN DEFAULT false,
  decision_trace_id UUID,
  ai_decisions_made JSONB DEFAULT '[]',
  prev_hash TEXT,
  row_hash TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 4. CAMPAIGN METRICS
CREATE TABLE IF NOT EXISTS public.campaign_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calls_attempted INTEGER DEFAULT 0,
  calls_completed INTEGER DEFAULT 0,
  calls_connected INTEGER DEFAULT 0,
  interest_rate NUMERIC(5,2),
  conversion_rate NUMERIC(5,2),
  objection_rate NUMERIC(5,2),
  opt_out_rate NUMERIC(5,2),
  escalation_rate NUMERIC(5,2),
  avg_confidence_score NUMERIC(5,4),
  avg_call_duration_seconds INTEGER,
  compliance_score NUMERIC(5,2),
  handoff_count INTEGER DEFAULT 0,
  handoff_success_rate NUMERIC(5,2),
  objection_categories JSONB DEFAULT '{}',
  containment_triggers INTEGER DEFAULT 0
);

-- 5. CONTAINMENT LOG
CREATE TABLE IF NOT EXISTS public.campaign_containment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  trigger_details JSONB DEFAULT '{}',
  containment_action TEXT NOT NULL,
  previous_mode TEXT,
  new_mode TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PRODUCT PLAYBOOKS
CREATE TABLE IF NOT EXISTS public.product_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_description TEXT,
  sku_codes TEXT[] DEFAULT '{}',
  key_value_propositions TEXT[] NOT NULL DEFAULT '{}',
  opening_hook TEXT,
  objection_handlers JSONB DEFAULT '{}',
  forbidden_promises TEXT[] DEFAULT '{}',
  required_disclaimers TEXT[] DEFAULT '{}',
  pricing_bounds JSONB DEFAULT '{}',
  confidence_floor NUMERIC(5,4) DEFAULT 0.75,
  escalation_triggers TEXT[] DEFAULT '{}',
  tone_guidance TEXT,
  is_active BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. VENDOR PLAYBOOKS
CREATE TABLE IF NOT EXISTS public.vendor_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id),
  service_category TEXT NOT NULL,
  outreach_goal TEXT NOT NULL,
  website_signup_explanation TEXT,
  platform_benefits TEXT[] DEFAULT '{}',
  benefits_framing TEXT[] DEFAULT '{}',
  opening_hook TEXT,
  objection_handlers JSONB DEFAULT '{}',
  forbidden_promises TEXT[] DEFAULT '{}',
  required_disclaimers TEXT[] DEFAULT '{}',
  confidence_floor NUMERIC(5,4) DEFAULT 0.75,
  escalation_triggers TEXT[] DEFAULT '{}',
  tone_guidance TEXT,
  is_active BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. OPT-OUT REGISTRY
CREATE TABLE IF NOT EXISTS public.outbound_opt_out_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  business_id UUID REFERENCES public.businesses(id),
  opt_out_scope TEXT NOT NULL DEFAULT 'business',
  campaign_type_excluded TEXT,
  source TEXT NOT NULL DEFAULT 'call_request',
  campaign_id UUID REFERENCES public.outbound_campaigns(id),
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(phone_number, business_id, opt_out_scope)
);

-- Enable RLS
ALTER TABLE public.outbound_campaign_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_call_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_containment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_opt_out_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "auth_select_campaign_types" ON public.outbound_campaign_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_call_frames" ON public.campaign_call_frames FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_call_frames" ON public.campaign_call_frames FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_select_metrics" ON public.campaign_metrics_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_metrics" ON public.campaign_metrics_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_select_containment" ON public.campaign_containment_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_containment" ON public.campaign_containment_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_all_product_playbooks" ON public.product_playbooks FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_vendor_playbooks" ON public.vendor_playbooks FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_opt_outs" ON public.outbound_opt_out_registry FOR ALL TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_frames_campaign ON public.campaign_call_frames(campaign_id);
CREATE INDEX IF NOT EXISTS idx_metrics_campaign ON public.campaign_metrics_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_containment_campaign ON public.campaign_containment_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_product_playbooks_business ON public.product_playbooks(business_id);
CREATE INDEX IF NOT EXISTS idx_vendor_playbooks_business ON public.vendor_playbooks(business_id);
CREATE INDEX IF NOT EXISTS idx_opt_out_phone ON public.outbound_opt_out_registry(phone_number);