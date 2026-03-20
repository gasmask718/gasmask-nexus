
-- Market intelligence table
CREATE TABLE IF NOT EXISTS brandaro_market_intelligence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL,
  industry TEXT NOT NULL,
  total_searches INTEGER DEFAULT 0,
  total_found INTEGER DEFAULT 0,
  total_imported INTEGER DEFAULT 0,
  avg_import_rate NUMERIC(5,2) DEFAULT 0,
  leads_contacted INTEGER DEFAULT 0,
  leads_responded INTEGER DEFAULT 0,
  leads_interested INTEGER DEFAULT 0,
  leads_closed INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  revenue_generated NUMERIC(10,2) DEFAULT 0,
  discovery_score INTEGER DEFAULT 50,
  conversion_score INTEGER DEFAULT 50,
  market_score INTEGER DEFAULT 50,
  avg_business_size TEXT DEFAULT 'small',
  website_adoption_rate NUMERIC(5,2) DEFAULT 50,
  competition_level TEXT DEFAULT 'medium',
  best_time_to_contact TEXT DEFAULT 'morning',
  typical_objection TEXT,
  winning_pitch TEXT,
  trend TEXT DEFAULT 'stable',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(state, industry)
);

-- Industry intelligence table
CREATE TABLE IF NOT EXISTS brandaro_industry_intelligence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  industry TEXT NOT NULL UNIQUE,
  avg_revenue_per_sale NUMERIC(10,2) DEFAULT 299,
  website_adoption_rate NUMERIC(5,2) DEFAULT 30,
  avg_business_age_years NUMERIC(5,1) DEFAULT 5,
  decision_maker TEXT DEFAULT 'owner',
  avg_response_rate NUMERIC(5,2) DEFAULT 15,
  avg_close_rate NUMERIC(5,2) DEFAULT 8,
  best_outreach_channel TEXT DEFAULT 'sms',
  best_time_of_day TEXT DEFAULT 'morning',
  best_day_of_week TEXT DEFAULT 'tuesday',
  pain_points JSONB DEFAULT '[]',
  winning_hooks JSONB DEFAULT '[]',
  common_objections JSONB DEFAULT '[]',
  priority_score INTEGER DEFAULT 5,
  trend TEXT DEFAULT 'stable',
  notes TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Seed industry intelligence
INSERT INTO brandaro_industry_intelligence (industry, website_adoption_rate, avg_response_rate, avg_close_rate, priority_score, pain_points, winning_hooks, common_objections, best_time_of_day, best_day_of_week)
VALUES
('house cleaning', 18, 24, 12, 10, '["no online presence","relies on word of mouth","loses to competitors with websites"]', '["We built you a free website","Customers search Google before calling","Your competitor has a website"]', '["too expensive","already get referrals","not tech savvy"]', 'morning', 'tuesday'),
('carpet cleaning', 20, 22, 11, 9, '["seasonal business needs year-round leads","no way for customers to find them online"]', '["Get found on Google","Free demo site ready","More calls from new customers"]', '["too expensive","busy right now"]', 'morning', 'monday'),
('moving company', 25, 20, 10, 9, '["peak season dependent","no way to show reviews","loses to larger companies"]', '["Customers book movers online now","Free website shows your reviews","Get more bookings"]', '["already busy","have facebook page"]', 'morning', 'wednesday'),
('junk removal', 15, 26, 13, 10, '["zero online presence","completely dependent on flyers"]', '["People search junk removal on Google","Free site in 30 seconds","More calls this week"]', '["not interested","too small"]', 'morning', 'tuesday'),
('painting contractor', 22, 21, 11, 9, '["project-based needs steady flow","no portfolio online"]', '["Show your work online","Customers check websites before calling","Free portfolio site"]', '["get jobs from referrals","too expensive"]', 'morning', 'monday'),
('landscaping', 28, 19, 9, 8, '["seasonal gaps","no way to show portfolio","loses to bigger companies"]', '["Get year-round customers","Show your work online","Free website ready"]', '["too busy in season","referrals enough"]', 'morning', 'tuesday'),
('handyman', 20, 23, 12, 9, '["inconsistent work flow","no professional presence"]', '["Look professional online","Customers Google handymen","Free website today"]', '["too small","word of mouth works"]', 'morning', 'monday'),
('pressure washing', 14, 25, 13, 10, '["extremely low website adoption","highly local service"]', '["No one else on Google in your area","Free site gets you found","More calls guaranteed"]', '["seasonal","small operation"]', 'morning', 'tuesday'),
('auto detailing', 22, 21, 10, 8, '["walk-in dependent","no booking system","loses mobile customers"]', '["Book appointments online","Get found on Google Maps","Free professional site"]', '["already have instagram","busy enough"]', 'morning', 'saturday'),
('window cleaning', 16, 24, 12, 9, '["zero online presence","relies on flyers and door knocking"]', '["Customers Google window cleaners","Free website in minutes","Beat your competition"]', '["small business","referrals only"]', 'morning', 'tuesday'),
('tree service', 19, 22, 11, 9, '["emergency based needs online presence","no way to show credentials"]', '["Get emergency calls from Google","Show your equipment","Free professional site"]', '["busy after storms","referrals work"]', 'morning', 'monday'),
('pool service', 24, 20, 10, 8, '["seasonal dependency","needs year-round maintenance customers"]', '["Keep customers year round","Get found by pool owners","Free site shows services"]', '["seasonal business","enough customers"]', 'morning', 'tuesday'),
('appliance repair', 21, 22, 11, 8, '["emergency based but no online booking","loses to Best Buy and chains"]', '["Beat the chains locally","Emergency calls go to Google","Free site with booking"]', '["compete with big stores","small operation"]', 'morning', 'wednesday'),
('locksmith', 15, 27, 14, 10, '["emergency only finds go to top Google result","extremely low website adoption"]', '["Emergency calls need top Google spot","Free site gets you found first","Beat other locksmiths"]', '["already listed on yelp","busy enough"]', 'any', 'any'),
('roofing contractor', 30, 18, 9, 8, '["project based needs steady pipeline","no way to show past work"]', '["Show your projects online","Homeowners Google roofers first","Free portfolio site"]', '["referrals only","busy season"]', 'morning', 'monday'),
('flooring', 32, 17, 8, 7, '["showroom dependent but no online presence","loses to Home Depot"]', '["Beat Home Depot locally","Show your work online","Free site with gallery"]', '["have a showroom","referrals work"]', 'morning', 'tuesday'),
('hvac', 35, 16, 8, 7, '["emergency calls go to Google","seasonal demand needs year-round presence"]', '["Get emergency HVAC calls","Be found on Google","Free professional site"]', '["already on google maps","busy"]', 'morning', 'monday'),
('plumber', 38, 15, 7, 7, '["emergency calls go online","higher website adoption than others"]', '["Be the first result for emergency calls","Free site with phone prominent","Beat other plumbers"]', '["already have website","referrals"]', 'morning', 'any'),
('electrician', 36, 15, 7, 6, '["licensed but no online presence","loses commercial jobs without website"]', '["Get commercial clients","Look licensed and professional","Free site with credentials"]', '["licensed already found","referrals"]', 'morning', 'monday'),
('mobile mechanic', 12, 28, 14, 10, '["extremely low website adoption","growing service with no online presence"]', '["No mobile mechanics online in your area","Customers love mobile service","Free site today"]', '["word of mouth","small operation"]', 'morning', 'tuesday'),
('gutter cleaning', 13, 26, 13, 10, '["almost zero online presence","highly local service"]', '["No gutter cleaners online near you","Free site gets you all local calls","Easy win on Google"]', '["seasonal","small"]', 'morning', 'tuesday'),
('drywall contractor', 18, 23, 11, 9, '["subcontractor mindset no direct marketing","no portfolio"]', '["Get direct homeowner calls","Show your work","Free site with gallery"]', '["work through GC","referrals"]', 'morning', 'monday'),
('fence contractor', 20, 22, 11, 9, '["seasonal and project based","no way to show portfolio"]', '["Homeowners Google fence companies","Show your installations","Free portfolio site"]', '["busy in summer","referrals"]', 'morning', 'tuesday'),
('concrete contractor', 25, 20, 10, 8, '["commercial and residential mix","no online portfolio"]', '["Show your projects","Get residential calls","Free professional site"]', '["referrals from GC","busy"]', 'morning', 'monday'),
('pest control', 28, 19, 9, 7, '["competing with Terminix needs differentiation","local angle important"]', '["Beat Terminix locally","Local family owned pitch","Free site with guarantee"]', '["competing with big companies"]', 'morning', 'tuesday')
ON CONFLICT (industry) DO NOTHING;

-- Add market intelligence columns to scout config
ALTER TABLE brandaro_scout_config
ADD COLUMN IF NOT EXISTS use_market_intelligence BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS min_industry_priority INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS prioritize_high_conversion BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_discover_new_markets BOOLEAN DEFAULT TRUE;
