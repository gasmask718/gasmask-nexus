
-- Phase 8: Follow-up delivery fields
ALTER TABLE public.brandaro_followup_sequences 
  ADD COLUMN IF NOT EXISTS sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_received BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Phase 9: Inbound reply engine
CREATE TABLE IF NOT EXISTS public.brandaro_inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id),
  followup_id UUID,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms',
  sender_phone TEXT,
  sender_email TEXT,
  intent_detected TEXT,
  requires_va BOOLEAN DEFAULT false,
  ai_auto_responded BOOLEAN DEFAULT false,
  ai_response TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_inbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage inbound messages" ON public.brandaro_inbound_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 10: Demo quality scoring
CREATE TABLE IF NOT EXISTS public.brandaro_demo_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id UUID,
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id),
  design_score INTEGER DEFAULT 0,
  uniqueness_score INTEGER DEFAULT 0,
  conversion_score INTEGER DEFAULT 0,
  cta_present BOOLEAN DEFAULT false,
  mobile_friendly BOOLEAN DEFAULT false,
  overall_score INTEGER DEFAULT 0,
  flagged BOOLEAN DEFAULT false,
  review_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_demo_quality_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage demo scores" ON public.brandaro_demo_quality_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 12/13: Close acceleration fields
ALTER TABLE public.brandaro_close_pipeline
  ADD COLUMN IF NOT EXISTS demo_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_nudge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nudge_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_link_clicked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgency_level TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS auto_close_eligible BOOLEAN DEFAULT false;

-- Phase 14: Design learning
ALTER TABLE public.brandaro_close_pipeline
  ADD COLUMN IF NOT EXISTS design_profile_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS design_colors TEXT[],
  ADD COLUMN IF NOT EXISTS design_layout TEXT,
  ADD COLUMN IF NOT EXISTS design_cta_style TEXT,
  ADD COLUMN IF NOT EXISTS revenue_amount NUMERIC DEFAULT 0;
