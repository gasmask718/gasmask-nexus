-- =============================================
-- PHASE 1: Design System + Design Variants
-- =============================================

CREATE TABLE IF NOT EXISTS public.brandaro_design_system (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_type TEXT NOT NULL, -- hero, services, testimonials, gallery, cta, footer
  layout_type TEXT NOT NULL DEFAULT 'centered', -- grid, split, centered, asymmetrical
  animation_type TEXT DEFAULT 'fade', -- fade, slide, scale, hover, none
  color_scheme JSONB DEFAULT '{}', -- { primary, secondary, accent }
  font_pairing JSONB DEFAULT '{}', -- { heading_font, body_font }
  conversion_elements JSONB DEFAULT '{}', -- { cta_text, trust_badges, urgency_flags }
  html_template TEXT,
  css_snippet TEXT,
  effectiveness_score NUMERIC DEFAULT 50,
  times_used INTEGER DEFAULT 0,
  times_converted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_design_system ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage design system"
  ON public.brandaro_design_system FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.brandaro_design_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'modern', -- luxury, modern, bold, minimal, nightlife, corporate
  section_sequence JSONB DEFAULT '[]', -- ordered list of section_type ids
  animation_profile TEXT DEFAULT 'subtle',
  color_profile JSONB DEFAULT '{}',
  font_profile JSONB DEFAULT '{}',
  revenue_generated NUMERIC DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  avg_close_rate NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_design_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage design variants"
  ON public.brandaro_design_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- PHASE 2: Learning Feedback + Objection Library
-- =============================================

CREATE TABLE IF NOT EXISTS public.brandaro_learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE SET NULL,
  call_id UUID,
  feedback_type TEXT NOT NULL, -- deal_closed, deal_lost, va_override, objection_handled
  objection_type TEXT,
  outcome TEXT, -- closed, lost, callback, nurture
  deal_value NUMERIC,
  va_notes TEXT,
  ai_notes TEXT,
  website_score INTEGER,
  design_variant_id UUID REFERENCES public.brandaro_design_variants(id) ON DELETE SET NULL,
  follow_up_messages_sent INTEGER DEFAULT 0,
  time_to_close_hours NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_learning_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage learning feedback"
  ON public.brandaro_learning_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.brandaro_objection_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objection_type TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'general', -- price, timing, trust, competition, need
  frequency INTEGER DEFAULT 0,
  success_rate NUMERIC DEFAULT 0,
  best_response TEXT,
  alternative_responses TEXT[],
  industries_common TEXT[],
  avg_deal_value_when_handled NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_objection_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage objection library"
  ON public.brandaro_objection_library FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed common objections
INSERT INTO public.brandaro_objection_library (objection_type, category, best_response, alternative_responses) VALUES
  ('too_expensive', 'price', 'I totally get that — most of our clients felt the same way. But when they saw the ROI from new customers finding them online, it paid for itself in the first month.', ARRAY['What if I could show you how it pays for itself?', 'We have flexible options — what budget works for you?']),
  ('already_have_website', 'need', 'That''s great! How''s it working for you? Most businesses we talk to have a site but it''s not actually bringing in customers. That''s the gap we fill.', ARRAY['When was the last time it brought you a new customer?', 'Can I show you what a modern version would look like?']),
  ('not_right_now', 'timing', 'Totally understand. What I can do is put together a quick demo so when you''re ready, it''s all set. No pressure — just want you to see what''s possible.', ARRAY['What would make the timing right?', 'Most people say that — then they see the demo and realize they''re leaving money on the table.']),
  ('need_to_think', 'timing', 'Of course! What specifically would you want to think about? I might be able to answer that right now.', ARRAY['Take your time — the demo will be ready whenever you are.', 'What questions do you still have?']),
  ('dont_trust_online', 'trust', 'I hear you — there''s a lot of noise out there. That''s why we show you a real demo for YOUR business before you pay anything. No risk.', ARRAY['We''ve worked with [X] businesses in your area. Happy to share references.'])
ON CONFLICT (objection_type) DO NOTHING;

-- =============================================
-- PHASE 3: VA Task Queue
-- =============================================

CREATE TABLE IF NOT EXISTS public.brandaro_va_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id UUID,
  task_type TEXT NOT NULL, -- call_lead, review_demo, fix_website, respond_inbound, manual_close, approve_demo
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE,
  call_id UUID,
  demo_score_id UUID,
  priority TEXT DEFAULT 'normal', -- low, normal, high, critical
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, skipped
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_va_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage VA tasks"
  ON public.brandaro_va_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- PHASE 4: Client Experience - brandaro_client_views
-- =============================================

CREATE TABLE IF NOT EXISTS public.brandaro_client_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  demo_html TEXT,
  status TEXT DEFAULT 'demo_ready', -- demo_ready, in_progress, ready_to_launch, launched
  package_tier TEXT DEFAULT 'starter',
  custom_price NUMERIC,
  change_requests JSONB DEFAULT '[]',
  views_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  payment_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_client_views ENABLE ROW LEVEL SECURITY;
-- Public read access via access_token (no auth required for client view)
CREATE POLICY "Public read via token"
  ON public.brandaro_client_views FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated users manage client views"
  ON public.brandaro_client_views FOR ALL TO authenticated USING (true) WITH CHECK (true);