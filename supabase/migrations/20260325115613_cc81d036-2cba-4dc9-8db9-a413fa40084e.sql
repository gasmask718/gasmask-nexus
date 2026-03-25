
-- Solar Property Intelligence
CREATE TABLE public.solar_property_intelligence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.solar_leads(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  roof_estimated_sqft NUMERIC,
  estimated_panel_count INTEGER,
  estimated_system_kw NUMERIC,
  estimated_monthly_savings NUMERIC,
  sunlight_score INTEGER DEFAULT 0,
  roof_complexity_score INTEGER DEFAULT 50,
  confidence_score INTEGER DEFAULT 70,
  data_source TEXT DEFAULT 'ai_estimate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.solar_property_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read solar property intelligence"
  ON public.solar_property_intelligence FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert solar property intelligence"
  ON public.solar_property_intelligence FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update solar property intelligence"
  ON public.solar_property_intelligence FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Solar Closing Sessions
CREATE TABLE public.solar_closing_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.solar_leads(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL DEFAULT 'chat',
  transcript TEXT,
  objections_detected JSONB DEFAULT '[]'::jsonb,
  intent_score INTEGER DEFAULT 0,
  closing_stage TEXT DEFAULT 'intro',
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.solar_closing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage solar closing sessions"
  ON public.solar_closing_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Solar Objection Library
CREATE TABLE public.solar_objection_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objection_type TEXT NOT NULL,
  trigger_keywords TEXT[] DEFAULT '{}',
  recommended_responses JSONB DEFAULT '[]'::jsonb,
  success_rate NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.solar_objection_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read solar objection library"
  ON public.solar_objection_library FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage solar objection library"
  ON public.solar_objection_library FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed objection library
INSERT INTO public.solar_objection_library (objection_type, trigger_keywords, recommended_responses, success_rate) VALUES
('too_expensive', ARRAY['expensive', 'cost', 'afford', 'money', 'price'], '[{"response": "Most homeowners go solar with $0 down. Your monthly payment is typically less than your current electric bill.", "type": "savings_framing"}, {"response": "The 30% federal tax credit alone saves thousands. This is literally the cheapest solar has ever been.", "type": "urgency"}]'::jsonb, 72),
('not_interested', ARRAY['not interested', 'no thanks', 'pass'], '[{"response": "I hear you. Before you go — did you know homeowners in your area are saving $150-300/month? It costs nothing to see your number.", "type": "curiosity"}, {"response": "Totally understand. Most of our happiest customers said the same thing initially. Can I ask what specifically you''re not interested in?", "type": "redirect"}]'::jsonb, 58),
('need_spouse', ARRAY['spouse', 'husband', 'wife', 'partner', 'talk to'], '[{"response": "Absolutely — this is a big decision. Would it help if I sent you both a personalized savings report so you can review it together?", "type": "soft_close"}, {"response": "Smart move. Most couples love seeing the numbers side by side. Can I schedule a quick call when you''re both available?", "type": "appointment"}]'::jsonb, 65),
('need_time', ARRAY['think about', 'not ready', 'later', 'timing'], '[{"response": "This is just a free savings plan — no commitment. It simply shows what you qualify for before incentives change.", "type": "risk_reversal"}, {"response": "The federal tax credit drops next quarter. Getting your estimate now locks in today''s rates with zero obligation.", "type": "urgency"}]'::jsonb, 70),
('already_have_solar', ARRAY['already have', 'have solar', 'panels already'], '[{"response": "Great! How''s it working for you? We help existing solar owners optimize and expand their systems for even more savings.", "type": "expansion"}, {"response": "Awesome! Are you getting the maximum output? Many systems installed 5+ years ago can be upgraded for 30-40% more production.", "type": "upgrade"}]'::jsonb, 45);
