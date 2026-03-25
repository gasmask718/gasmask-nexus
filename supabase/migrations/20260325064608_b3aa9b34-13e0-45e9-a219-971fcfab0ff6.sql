
-- Objection library for Sales Mastery Engine
CREATE TABLE IF NOT EXISTS sales_mastery_objections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hub TEXT NOT NULL CHECK (hub IN ('real_estate', 'surplus_funds', 'both')),
  objection_text TEXT NOT NULL,
  best_response TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  source_call_id TEXT,
  win_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call scoring for Sales Mastery Engine
CREATE TABLE IF NOT EXISTS sales_mastery_call_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hub TEXT NOT NULL CHECK (hub IN ('real_estate', 'surplus_funds')),
  va_id UUID,
  lead_id UUID,
  call_sid TEXT,
  opening_score INTEGER CHECK (opening_score BETWEEN 1 AND 10),
  qualifying_score INTEGER CHECK (qualifying_score BETWEEN 1 AND 10),
  objection_score INTEGER CHECK (objection_score BETWEEN 1 AND 10),
  close_score INTEGER CHECK (close_score BETWEEN 1 AND 10),
  overall_score NUMERIC,
  what_went_well TEXT,
  what_to_improve TEXT,
  is_training_call BOOLEAN DEFAULT false,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VA Leaderboard tracking
CREATE TABLE IF NOT EXISTS sales_mastery_leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hub TEXT NOT NULL CHECK (hub IN ('real_estate', 'surplus_funds')),
  va_name TEXT NOT NULL,
  va_id UUID,
  calls_made INTEGER DEFAULT 0,
  contacts_reached INTEGER DEFAULT 0,
  offers_submitted INTEGER DEFAULT 0,
  contracts_signed INTEGER DEFAULT 0,
  revenue_generated NUMERIC DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI coaching triggers
CREATE TABLE IF NOT EXISTS sales_mastery_coaching_triggers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hub TEXT NOT NULL CHECK (hub IN ('real_estate', 'surplus_funds', 'both')),
  trigger_keyword TEXT NOT NULL,
  coaching_card_title TEXT NOT NULL,
  coaching_card_body TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed RE objections
INSERT INTO sales_mastery_objections (hub, objection_text, best_response, category) VALUES
('real_estate', 'Too low', 'I hear you. What''s your number based on? Because if there''s room to work, I want to find it.', 'price'),
('real_estate', 'Need to think about it', 'Of course. What''s the one thing holding you?', 'stall'),
('real_estate', 'Already have an agent', 'Respect that. When''s their listing expire? Because cash buyers close faster than any listed sale.', 'competition'),
('real_estate', 'Not interested', 'Fair enough. Can I ask — is it the price or the timing that doesn''t work? Because one of those I might be able to fix.', 'rejection'),
('real_estate', 'I need more money', 'What number would make this work for you? Let me see if we can get there.', 'price'),
('real_estate', 'The house is worth more', 'You might be right. What are you basing that on — Zillow, an appraisal, or comps? Let me run the actual numbers with you.', 'price');

-- Seed SF objections
INSERT INTO sales_mastery_objections (hub, objection_text, best_response, category) VALUES
('surplus_funds', 'This sounds like a scam', 'I totally understand your concern. We''re a licensed recovery firm that works with attorneys to file legitimate court claims. You can verify us at our website. We don''t get paid unless you get paid — that''s our guarantee.', 'trust'),
('surplus_funds', 'I already claimed my funds', 'That''s great! Just to confirm — are you sure there isn''t an additional surplus from a separate sale or judgment? We often find people have more than one claim.', 'objection'),
('surplus_funds', 'How much do you take?', 'Our standard is 35% of recovered funds. Without us, most people never find out this money exists. We handle everything. You don''t pay a dime unless we recover your money.', 'price'),
('surplus_funds', 'I need to talk to my lawyer', 'Absolutely, please do! Most attorneys don''t specialize in surplus recovery — we do. Happy to speak with your attorney directly.', 'stall'),
('surplus_funds', 'How long does this take?', 'Typically 60-90 days depending on the county and court schedule. We''ll keep you updated every step of the way.', 'timeline');

-- Seed coaching triggers
INSERT INTO sales_mastery_coaching_triggers (hub, trigger_keyword, coaching_card_title, coaching_card_body, priority) VALUES
('both', 'inheritance', '🔥 MOTIVATED SELLER', 'Inheritance = motivated. Move to pricing faster. They likely want this resolved quickly.', 1),
('both', 'need to think', '⏰ STALL DETECTED', 'Use: "What''s the one thing holding you?" — isolate the real objection.', 2),
('both', 'price', '💰 PRICE SENSITIVITY', 'Do NOT anchor first. Ask what their number is based on. Let them set the frame.', 3),
('both', 'quiet', '🤫 SILENCE IS GOLDEN', 'Silence is okay. Wait. Don''t fill it. The next person to speak loses.', 4),
('both', 'divorce', '🔥 HIGH MOTIVATION', 'Divorce = speed matters. Emphasize fast close timeline and simplicity.', 1),
('both', 'behind on payments', '🔥 URGENCY SIGNAL', 'Financial distress detected. Lead with timeline: "We can close before your next payment is due."', 1),
('real_estate', 'zillow', '📊 COMP CHALLENGE', 'Zillow estimates are often wrong. Offer to show actual sold comps in their neighborhood.', 3),
('surplus_funds', 'scam', '🛡️ TRUST BUILDING', 'Lead with credentials: licensed firm, attorney partners, no upfront fees. Offer verification.', 1);
