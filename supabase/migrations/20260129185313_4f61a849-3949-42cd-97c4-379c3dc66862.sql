-- =============================================
-- INFLUENCER ANALYTICS SYSTEM TABLES
-- =============================================

-- Social accounts per influencer (multi-platform support)
CREATE TABLE public.influencer_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'other')),
  handle TEXT NOT NULL,
  profile_url TEXT,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  connection_status TEXT DEFAULT 'connected' CHECK (connection_status IN ('connected', 'needs_reconnect', 'disconnected')),
  last_synced_at TIMESTAMPTZ,
  access_token_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(influencer_id, platform)
);

-- Post metrics time-series (daily snapshots)
CREATE TABLE public.influencer_post_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES influencer_posts(id) ON DELETE CASCADE NOT NULL,
  metric_date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, metric_date)
);

-- Tracking links for compliant retargeting
CREATE TABLE public.influencer_tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES influencer_campaigns(id) ON DELETE SET NULL,
  link_name TEXT NOT NULL,
  original_url TEXT NOT NULL,
  tracking_url TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Promo codes for influencer attribution
CREATE TABLE public.influencer_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES influencer_campaigns(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Influencer payouts
CREATE TABLE public.influencer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES influencer_campaigns(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payout_type TEXT DEFAULT 'campaign' CHECK (payout_type IN ('campaign', 'bonus', 'affiliate', 'flat_fee', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Influencer aggregate metrics (calculated/cached)
CREATE TABLE public.influencer_metrics_aggregate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_exposures BIGINT DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_reach BIGINT DEFAULT 0,
  total_likes BIGINT DEFAULT 0,
  total_comments BIGINT DEFAULT 0,
  total_shares BIGINT DEFAULT 0,
  total_saves BIGINT DEFAULT 0,
  avg_engagement_rate NUMERIC(5,2) DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  milestone_1m_reached_at TIMESTAMPTZ,
  milestone_10m_reached_at TIMESTAMPTZ,
  milestone_50m_reached_at TIMESTAMPTZ,
  milestone_100m_reached_at TIMESTAMPTZ,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add platform column to influencer_posts if not exists
ALTER TABLE public.influencer_posts 
  ADD COLUMN IF NOT EXISTS influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative'));

-- Enable RLS on all new tables
ALTER TABLE public.influencer_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_post_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_metrics_aggregate ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users (read access)
CREATE POLICY "Authenticated users can view social accounts" ON public.influencer_social_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view post metrics" ON public.influencer_post_metrics_daily
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view tracking links" ON public.influencer_tracking_links
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view promo codes" ON public.influencer_promo_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view payouts" ON public.influencer_payouts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view metrics aggregate" ON public.influencer_metrics_aggregate
  FOR SELECT TO authenticated USING (true);

-- Admin/service can manage all data
CREATE POLICY "Admins can manage social accounts" ON public.influencer_social_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage post metrics" ON public.influencer_post_metrics_daily
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage tracking links" ON public.influencer_tracking_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage promo codes" ON public.influencer_promo_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage payouts" ON public.influencer_payouts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage metrics aggregate" ON public.influencer_metrics_aggregate
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_influencer_social_accounts_influencer ON public.influencer_social_accounts(influencer_id);
CREATE INDEX idx_influencer_post_metrics_post ON public.influencer_post_metrics_daily(post_id);
CREATE INDEX idx_influencer_post_metrics_date ON public.influencer_post_metrics_daily(metric_date);
CREATE INDEX idx_influencer_tracking_links_influencer ON public.influencer_tracking_links(influencer_id);
CREATE INDEX idx_influencer_promo_codes_influencer ON public.influencer_promo_codes(influencer_id);
CREATE INDEX idx_influencer_payouts_influencer ON public.influencer_payouts(influencer_id);
CREATE INDEX idx_influencer_payouts_status ON public.influencer_payouts(status);