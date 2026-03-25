
-- Solar Partner Performance tracking
CREATE TABLE public.solar_partner_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.solar_partners(id) ON DELETE CASCADE NOT NULL,
  leads_received integer DEFAULT 0,
  leads_contacted integer DEFAULT 0,
  appointments_set integer DEFAULT 0,
  deals_closed integer DEFAULT 0,
  deals_lost integer DEFAULT 0,
  close_rate numeric DEFAULT 0,
  avg_deal_value numeric DEFAULT 0,
  avg_response_time_minutes numeric DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

ALTER TABLE public.solar_partner_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view partner performance" ON public.solar_partner_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert partner performance" ON public.solar_partner_performance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update partner performance" ON public.solar_partner_performance FOR UPDATE TO authenticated USING (true);

-- Solar Partner Rankings
CREATE TABLE public.solar_partner_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.solar_partners(id) ON DELETE CASCADE NOT NULL,
  ranking_score numeric DEFAULT 0,
  tier text DEFAULT 'C',
  priority_level integer DEFAULT 5,
  state_performance jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.solar_partner_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view partner rankings" ON public.solar_partner_rankings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage partner rankings" ON public.solar_partner_rankings FOR ALL TO authenticated USING (true);

-- Solar Partner Outreach
CREATE TABLE public.solar_partner_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.solar_partners(id) ON DELETE CASCADE NOT NULL,
  outreach_type text NOT NULL DEFAULT 'email',
  message_sent text,
  response text,
  status text DEFAULT 'sent',
  follow_up_date timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.solar_partner_outreach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view partner outreach" ON public.solar_partner_outreach FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage partner outreach" ON public.solar_partner_outreach FOR ALL TO authenticated USING (true);

-- Solar Partner Deals (enhanced from solar_deals)
CREATE TABLE public.solar_partner_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.solar_partners(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES public.solar_leads(id) ON DELETE SET NULL,
  deal_value numeric DEFAULT 0,
  commission_amount numeric DEFAULT 0,
  deal_status text DEFAULT 'sent',
  payout_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.solar_partner_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view partner deals" ON public.solar_partner_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage partner deals" ON public.solar_partner_deals FOR ALL TO authenticated USING (true);

-- Add missing columns to solar_partners
ALTER TABLE public.solar_partners 
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS service_areas text[],
  ADD COLUMN IF NOT EXISTS installer_type text DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS financing_options boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS contract_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarding_stage text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS notes text;
