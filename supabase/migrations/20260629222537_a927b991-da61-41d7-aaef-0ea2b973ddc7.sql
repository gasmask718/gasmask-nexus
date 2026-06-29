
CREATE TABLE IF NOT EXISTS public.dd_partner_wholesaler_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  wholesaler_id uuid REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  revenue_share_pct numeric DEFAULT 10,
  status text DEFAULT 'pending' CHECK (status IN ('pending','active','paused','terminated')),
  approved_by uuid,
  approved_at timestamptz,
  total_orders int DEFAULT 0,
  total_revenue_generated numeric DEFAULT 0,
  total_earned numeric DEFAULT 0,
  agreement_signed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ambassador_id, wholesaler_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_partner_wholesaler_links TO authenticated;
GRANT ALL ON public.dd_partner_wholesaler_links TO service_role;
ALTER TABLE public.dd_partner_wholesaler_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dd_pwl_admin_all" ON public.dd_partner_wholesaler_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "dd_pwl_ambassador_view" ON public.dd_partner_wholesaler_links
  FOR SELECT TO authenticated
  USING (ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.dd_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text UNIQUE NOT NULL,
  name text NOT NULL,
  ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  partner_wholesaler_link_id uuid REFERENCES public.dd_partner_wholesaler_links(id) ON DELETE SET NULL,
  preferred_wholesaler_id uuid REFERENCES public.wholesalers(id) ON DELETE SET NULL,
  product_ids uuid[] DEFAULT '{}',
  commission_override_pct numeric,
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  total_clicks int DEFAULT 0,
  total_orders int DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  total_commission numeric DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('draft','active','paused','ended')),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_campaigns TO authenticated;
GRANT ALL ON public.dd_campaigns TO service_role;
ALTER TABLE public.dd_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dd_camp_admin_all" ON public.dd_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "dd_camp_ambassador_view" ON public.dd_campaigns
  FOR SELECT TO authenticated
  USING (ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.dd_partner_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  wholesaler_id uuid REFERENCES public.wholesalers(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.dd_campaigns(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  order_revenue numeric NOT NULL,
  commission_pct numeric NOT NULL,
  commission_amount numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_partner_earnings TO authenticated;
GRANT ALL ON public.dd_partner_earnings TO service_role;
ALTER TABLE public.dd_partner_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dd_pe_admin_all" ON public.dd_partner_earnings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "dd_pe_ambassador_view" ON public.dd_partner_earnings
  FOR SELECT TO authenticated
  USING (ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid()));

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.dd_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_wholesaler_id uuid REFERENCES public.wholesalers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dd_campaigns_code ON public.dd_campaigns(campaign_code);
CREATE INDEX IF NOT EXISTS idx_dd_pe_status ON public.dd_partner_earnings(status);
CREATE INDEX IF NOT EXISTS idx_mp_orders_campaign ON public.marketplace_orders(campaign_id);
