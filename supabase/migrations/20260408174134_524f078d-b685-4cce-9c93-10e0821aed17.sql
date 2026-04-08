
-- Extend dsn_leads
ALTER TABLE public.dsn_leads ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'inbound';
ALTER TABLE public.dsn_leads ADD COLUMN IF NOT EXISTS affiliate_id TEXT;
ALTER TABLE public.dsn_leads ADD COLUMN IF NOT EXISTS campaign_id TEXT;
ALTER TABLE public.dsn_leads ADD COLUMN IF NOT EXISTS business_vertical TEXT DEFAULT 'solar';

-- Extend dsn_deals
ALTER TABLE public.dsn_deals ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'direct';
ALTER TABLE public.dsn_deals ADD COLUMN IF NOT EXISTS affiliate_id TEXT;
ALTER TABLE public.dsn_deals ADD COLUMN IF NOT EXISTS business_vertical TEXT DEFAULT 'solar';
ALTER TABLE public.dsn_deals ADD COLUMN IF NOT EXISTS brand_id TEXT;
ALTER TABLE public.dsn_deals ADD COLUMN IF NOT EXISTS revenue_channel TEXT DEFAULT 'sales';

-- Extend dsn_commissions
ALTER TABLE public.dsn_commissions ADD COLUMN IF NOT EXISTS affiliate_payout NUMERIC DEFAULT 0;
ALTER TABLE public.dsn_commissions ADD COLUMN IF NOT EXISTS network_override NUMERIC DEFAULT 0;
ALTER TABLE public.dsn_commissions ADD COLUMN IF NOT EXISTS platform_total_profit NUMERIC DEFAULT 0;

-- Affiliate Sales Bridge
CREATE TABLE public.dsn_affiliate_sales_bridge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.dsn_leads(id) ON DELETE SET NULL,
  affiliate_id TEXT,
  setter_id UUID REFERENCES public.dsn_sales_agents(id) ON DELETE SET NULL,
  closer_id UUID REFERENCES public.dsn_sales_agents(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.dsn_deals(id) ON DELETE SET NULL,
  revenue_split JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dsn_affiliate_sales_bridge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read bridge" ON public.dsn_affiliate_sales_bridge FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage bridge" ON public.dsn_affiliate_sales_bridge FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dsn_leads_vertical ON public.dsn_leads(business_vertical);
CREATE INDEX IF NOT EXISTS idx_dsn_leads_source_type ON public.dsn_leads(source_type);
CREATE INDEX IF NOT EXISTS idx_dsn_deals_vertical ON public.dsn_deals(business_vertical);
CREATE INDEX IF NOT EXISTS idx_dsn_deals_revenue_channel ON public.dsn_deals(revenue_channel);
CREATE INDEX IF NOT EXISTS idx_dsn_bridge_deal ON public.dsn_affiliate_sales_bridge(deal_id);
CREATE INDEX IF NOT EXISTS idx_dsn_bridge_affiliate ON public.dsn_affiliate_sales_bridge(affiliate_id);
