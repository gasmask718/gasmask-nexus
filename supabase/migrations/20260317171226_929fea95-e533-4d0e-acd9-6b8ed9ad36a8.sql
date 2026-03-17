
-- Brandaro Voice Agent Scripts (the controlled conversation flow)
CREATE TABLE public.brandaro_voice_agent_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_name TEXT NOT NULL,
  script_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  voice_style JSONB DEFAULT '{"tone": "friendly", "pace": "calm", "formality": "casual"}'::jsonb,
  call_structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  opening_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  qualification_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  value_positioning TEXT,
  demo_offer TEXT,
  soft_close TEXT,
  hard_close TEXT,
  failsafe TEXT,
  behavior_rules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Voice agent objection handlers (AI-specific, separate from VA text objections)
CREATE TABLE public.brandaro_voice_objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES public.brandaro_voice_agent_scripts(id) ON DELETE CASCADE,
  objection_key TEXT NOT NULL,
  trigger_phrases TEXT[] NOT NULL DEFAULT '{}',
  ai_response TEXT NOT NULL,
  followup_question TEXT,
  escalation_action TEXT DEFAULT 'continue',
  times_used INTEGER DEFAULT 0,
  times_converted INTEGER DEFAULT 0,
  effectiveness_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN times_used > 0 THEN ROUND((times_converted::numeric / times_used) * 100, 2) ELSE 0 END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Voice agent call outcomes (per-call tracking)
CREATE TABLE public.brandaro_voice_agent_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id),
  script_id UUID REFERENCES public.brandaro_voice_agent_scripts(id),
  call_sid TEXT,
  campaign_id TEXT,
  call_stage_reached TEXT DEFAULT 'greeting',
  objections_encountered TEXT[] DEFAULT '{}',
  objections_handled TEXT[] DEFAULT '{}',
  contact_captured BOOLEAN DEFAULT false,
  demo_requested BOOLEAN DEFAULT false,
  transferred_to_human BOOLEAN DEFAULT false,
  transfer_reason TEXT,
  handoff_score NUMERIC(5,2) DEFAULT 0,
  intent_level TEXT DEFAULT 'unknown',
  call_duration_seconds INTEGER,
  outcome TEXT DEFAULT 'in_progress',
  ai_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Handoff scoring thresholds
CREATE TABLE public.brandaro_handoff_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  min_intent_score NUMERIC(5,2) NOT NULL DEFAULT 70,
  required_stage TEXT DEFAULT 'demo_offer',
  trigger_phrases TEXT[] DEFAULT '{}',
  auto_transfer BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the default Brandaro sales script
INSERT INTO public.brandaro_voice_agent_scripts (
  script_name, script_version, is_active,
  voice_style,
  call_structure,
  opening_lines,
  qualification_questions,
  value_positioning,
  demo_offer,
  soft_close,
  hard_close,
  failsafe,
  behavior_rules
) VALUES (
  'Brandaro AI Closer v1', 1, true,
  '{"tone": "friendly", "pace": "calm", "formality": "casual_confident", "style": "conversational_not_scripted"}'::jsonb,
  '["greeting", "reason_for_call", "qualification", "problem_awareness", "value_positioning", "demo_offer", "objection_handling", "close"]'::jsonb,
  '[
    "Hey, is this the owner or manager?",
    "Hey — I''ll be super quick. I was just looking at your business online and noticed you don''t really have a strong website set up… are you getting customers from online right now?"
  ]'::jsonb,
  '[
    "Do you currently have a website?",
    "Is it bringing you customers consistently?",
    "Or mostly word of mouth right now?"
  ]'::jsonb,
  'What we do is build you a full professional site that''s actually set up to bring in customers — not just something that looks nice.',
  'What I can do is put together a quick demo for your business so you can see exactly how it would look and work. Would you want me to send that over?',
  'Let me do this — I''ll put together a quick version for your business and send it over. What''s the best number or email for you?',
  'Perfect — once you see it, we can get everything set up for you and have it live quickly.',
  'All good — I''ll just send something quick over so you can take a look when you have a second.',
  '["NEVER talk too long", "ALWAYS ask questions to keep control", "IF user speaks → listen and respond naturally", "IF confusion → simplify", "IF resistance → redirect, don''t argue", "ALWAYS move toward demo or contact capture"]'::jsonb
);

-- Seed objection handlers for the default script
INSERT INTO public.brandaro_voice_objections (script_id, objection_key, trigger_phrases, ai_response, followup_question) VALUES
(
  (SELECT id FROM public.brandaro_voice_agent_scripts WHERE script_name = 'Brandaro AI Closer v1' LIMIT 1),
  'too_expensive',
  ARRAY['too expensive', 'cost too much', 'can''t afford', 'out of budget', 'price', 'how much'],
  'I get that — most people think that at first. But this is built to actually bring you customers, so even one new job can cover it.',
  'Would it help to see what kind of results other businesses like yours have gotten?'
),
(
  (SELECT id FROM public.brandaro_voice_agent_scripts WHERE script_name = 'Brandaro AI Closer v1' LIMIT 1),
  'not_interested',
  ARRAY['not interested', 'no thanks', 'don''t need', 'pass', 'no'],
  'Totally understand — quick question though, are you already getting consistent customers online, or is that something you''d still want to improve?',
  NULL
),
(
  (SELECT id FROM public.brandaro_voice_agent_scripts WHERE script_name = 'Brandaro AI Closer v1' LIMIT 1),
  'existing_website',
  ARRAY['already have', 'got a website', 'have a site', 'existing website', 'already got one'],
  'Got you — is it actually bringing you customers consistently, or just kind of sitting there?',
  NULL
),
(
  (SELECT id FROM public.brandaro_voice_agent_scripts WHERE script_name = 'Brandaro AI Closer v1' LIMIT 1),
  'busy_timing',
  ARRAY['busy', 'not now', 'later', 'bad time', 'in a meeting', 'driving'],
  'I hear you — this would take less than a minute. I can just send you something to look at when you have time.',
  'What''s the best email to send that to?'
),
(
  (SELECT id FROM public.brandaro_voice_agent_scripts WHERE script_name = 'Brandaro AI Closer v1' LIMIT 1),
  'send_info',
  ARRAY['send me info', 'email me', 'send something', 'send details'],
  'Yeah I can send info — but honestly it''ll make more sense once you see a demo built for your business.',
  'Want me to put one together real quick?'
),
(
  (SELECT id FROM public.brandaro_voice_agent_scripts WHERE script_name = 'Brandaro AI Closer v1' LIMIT 1),
  'think_about_it',
  ARRAY['think about it', 'let me think', 'need to consider', 'not sure'],
  'Of course — usually when people say that it just means they need a little more clarity. What part are you unsure about?',
  NULL
);

-- Seed handoff rules
INSERT INTO public.brandaro_handoff_rules (rule_name, min_intent_score, required_stage, trigger_phrases, auto_transfer, priority) VALUES
('High Intent Demo Request', 85, 'demo_offer', ARRAY['yes send it', 'sounds good', 'let''s do it', 'I''m interested'], true, 1),
('Pricing Discussion Ready', 75, 'value_positioning', ARRAY['how much', 'what''s the cost', 'pricing'], false, 2),
('Explicit Human Request', 50, 'greeting', ARRAY['talk to a person', 'real person', 'human', 'manager'], true, 0);

-- Enable RLS
ALTER TABLE public.brandaro_voice_agent_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_voice_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_voice_agent_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_handoff_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies (authenticated users can read, service role handles writes)
CREATE POLICY "Authenticated users can read voice scripts" ON public.brandaro_voice_agent_scripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read voice objections" ON public.brandaro_voice_objections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read voice agent calls" ON public.brandaro_voice_agent_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert voice agent calls" ON public.brandaro_voice_agent_calls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update voice agent calls" ON public.brandaro_voice_agent_calls FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can read handoff rules" ON public.brandaro_handoff_rules FOR SELECT TO authenticated USING (true);
