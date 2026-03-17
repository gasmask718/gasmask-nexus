
-- Brandaro VA Sales Engine: Script steps + objection handlers

CREATE TABLE public.brandaro_sales_script_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_key TEXT NOT NULL UNIQUE,
  display_label TEXT NOT NULL,
  va_says TEXT NOT NULL,
  coaching_tip TEXT,
  wait_for_response BOOLEAN DEFAULT false,
  tag_lead_as TEXT,
  industry_type TEXT, -- null = universal
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.brandaro_objection_handlers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objection_key TEXT NOT NULL,
  objection_label TEXT NOT NULL,
  va_response TEXT NOT NULL,
  follow_up_question TEXT,
  coaching_tip TEXT,
  industry_type TEXT,
  effectiveness_score NUMERIC DEFAULT 50,
  times_used INTEGER DEFAULT 0,
  times_converted INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.brandaro_sales_script_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_objection_handlers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access on script steps" ON public.brandaro_sales_script_steps FOR ALL USING (true);
CREATE POLICY "Full access on objection handlers" ON public.brandaro_objection_handlers FOR ALL USING (true);

-- Seed the 8-step call flow
INSERT INTO public.brandaro_sales_script_steps (step_number, step_key, step_name, display_label, va_says, coaching_tip, wait_for_response, tag_lead_as) VALUES
(1, 'pattern_interrupt', 'Pattern Interrupt', '📞 Open', 'Hey, is this the owner or manager?', 'Calm, confident tone. Do NOT pitch yet.', true, NULL),
(2, 'reason_for_call', 'Reason for Call', '🎯 Reason', E'Hey [Name], I''ll be super quick — I was just looking at your business online and noticed you don''t have a proper website set up yet. Are you currently getting customers from online at all?', 'Keep it casual and conversational. Mirror their energy.', true, NULL),
(3, 'qualification', 'Qualification', '✅ Qualify', E'Quick question — do you currently have a website? Are you getting consistent customers online? Have you ever tried running ads or SEO?', 'Tag the lead based on answers: no_website, outdated_website, not_converting.', true, NULL),
(4, 'problem_amplification', 'Problem Amplification', '⚡ Problem', E'Yeah that''s actually exactly why I''m calling — most businesses in your space are losing a lot of customers because people search online first and if they don''t see a strong presence, they just go to the next option.', 'Let this land. Pause after. Don''t rush to the offer.', false, NULL),
(5, 'value_positioning', 'Value Positioning', '💎 Value', E'What we do is build you a full professional website for your business and set it up so you can actually start getting customers consistently — not just something that looks nice, but something that converts.', 'Focus on CUSTOMERS not WEBSITE. Frame = results.', false, NULL),
(6, 'soft_close', 'Soft Close', '🤝 Soft Close', E'What I can do real quick is actually put together a demo version for your business so you can see exactly how it would look and work — no commitment. Would you want me to send that over?', 'This is low-pressure. If they say yes, you''re golden.', true, 'interested'),
(7, 'hard_close', 'Hard Close', '🔥 Hard Close', E'Let''s do this — I''ll have a demo built specifically for your business and send it over. What''s the best number or email for you so I can send it?', 'Assumptive close. Act like it''s already decided.', true, 'hot_lead'),
(8, 'payment_close', 'Payment Close', '💰 Payment', E'We can get started today — once we lock this in, we begin building your full site immediately and have it ready quickly. I''ll send over the link now so we can secure your spot.', 'Confidence is everything here. No hesitation.', true, 'sold');

-- Seed objection handlers
INSERT INTO public.brandaro_objection_handlers (objection_key, objection_label, va_response, follow_up_question, coaching_tip) VALUES
('too_expensive', '💸 Too Expensive', E'I completely understand — most people think that at first. The difference is this isn''t just a website, it''s something that actually brings you customers. One new customer can easily cover the cost. That''s really the focus here.', 'What if I could show you how one customer pays for the whole thing?', 'Reframe cost as investment. Never defend the price.'),
('not_now', '⏰ Not Now', E'Totally get that — quick question though, is it that the timing is bad, or you''re just not sure if it''s worth doing?', E'If I could show you something that actually brings in customers, it would make sense to at least take a look, right?', 'Isolate the REAL objection. Timing is rarely the real issue.'),
('already_have_website', '🌐 Already Have Website', E'Got you — a lot of people we work with already had one. The real question is, is it actually bringing you customers consistently or just sitting there?', 'When was the last time you got a customer specifically from your website?', 'Don''t compete with their current site. Question its effectiveness.'),
('no_budget', '🚫 No Budget', E'I understand — that''s exactly why we keep it simple upfront. The goal is to help you generate more business first, then scale from there. That''s how most of our clients start.', 'What if we could start small and let the results fund the growth?', 'Show empathy. Position as revenue-first, not cost-first.'),
('need_to_think', '🤔 Need to Think', E'Of course — usually when people say that it just means they need a little more clarity. What part are you unsure about?', NULL, 'This is an invitation to re-sell. Find the real blocker.'),
('send_info', '📧 Send Me Info', E'Yeah I can definitely do that — but honestly it''ll make way more sense once you actually see a version built for your business. That''s why I usually send a demo first.', 'Can I grab your email and send you a custom demo instead?', 'Redirect to demo. Info packets kill deals.');
