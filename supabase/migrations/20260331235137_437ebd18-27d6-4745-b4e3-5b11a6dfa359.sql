
CREATE TABLE IF NOT EXISTS ut_ambassador_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT,
  bio TEXT,
  profile_url TEXT,
  profile_pic_url TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL DEFAULT 0,
  avg_likes INTEGER DEFAULT 0,
  avg_comments INTEGER DEFAULT 0,
  avg_views INTEGER DEFAULT 0,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  niche TEXT[],
  hashtags_used TEXT[],
  email TEXT,
  contact_phone TEXT,
  grade TEXT DEFAULT 'C',
  score INTEGER DEFAULT 0,
  ai_summary TEXT,
  ai_dm_message TEXT,
  ai_email_message TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'prospect',
  dm_sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  notes TEXT,
  fake_follower_pct DECIMAL DEFAULT 0,
  audience_quality_score INTEGER DEFAULT 0,
  brand_alignment_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, username)
);

ALTER TABLE ut_ambassador_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ambassador prospects"
ON ut_ambassador_prospects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert ambassador prospects"
ON ut_ambassador_prospects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update ambassador prospects"
ON ut_ambassador_prospects FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated delete ambassador prospects"
ON ut_ambassador_prospects FOR DELETE TO authenticated USING (true);
