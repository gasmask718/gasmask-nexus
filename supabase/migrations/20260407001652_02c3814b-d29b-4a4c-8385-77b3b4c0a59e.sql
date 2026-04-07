
-- Markup Rules Table
CREATE TABLE IF NOT EXISTS public.experience_markup_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  category TEXT,
  city TEXT,
  demand_level TEXT DEFAULT 'normal',
  markup_pct NUMERIC(5,2) NOT NULL DEFAULT 15,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_markup_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_view_markup_rules" ON public.experience_markup_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_markup_rules" ON public.experience_markup_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_markup_rules" ON public.experience_markup_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_markup_rules" ON public.experience_markup_rules FOR DELETE TO authenticated USING (true);
CREATE POLICY "service_manage_markup_rules" ON public.experience_markup_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Addon-Experience Links
CREATE TABLE IF NOT EXISTS public.experience_addon_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experience_id UUID NOT NULL REFERENCES public.experiences_master(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.experience_addons(id) ON DELETE CASCADE,
  UNIQUE(experience_id, addon_id)
);

ALTER TABLE public.experience_addon_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_view_addon_links" ON public.experience_addon_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_addon_links" ON public.experience_addon_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_delete_addon_links" ON public.experience_addon_links FOR DELETE TO authenticated USING (true);
CREATE POLICY "service_manage_addon_links" ON public.experience_addon_links FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Alerts Table
CREATE TABLE IF NOT EXISTS public.experience_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT,
  experience_id UUID REFERENCES public.experiences_master(id),
  booking_id UUID REFERENCES public.experience_bookings(id),
  payload JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_view_alerts" ON public.experience_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_alerts" ON public.experience_alerts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_manage_alerts" ON public.experience_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Customer Data Capture
CREATE TABLE IF NOT EXISTS public.experience_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT,
  phone TEXT,
  name TEXT,
  total_bookings INT NOT NULL DEFAULT 0,
  total_spend NUMERIC(10,2) NOT NULL DEFAULT 0,
  upsells_accepted INT NOT NULL DEFAULT 0,
  last_booking_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_view_customers" ON public.experience_customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_customers" ON public.experience_customers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Extend experience_bookings with profit tracking
ALTER TABLE public.experience_bookings
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_total NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_confirmation TEXT,
  ADD COLUMN IF NOT EXISTS supplier_type TEXT DEFAULT 'viator';

-- Add management policies for experiences_master (may already exist, use IF NOT EXISTS pattern)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'experiences_master' AND policyname = 'auth_update_experiences') THEN
    CREATE POLICY "auth_update_experiences" ON public.experiences_master FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'experiences_master' AND policyname = 'auth_insert_experiences') THEN
    CREATE POLICY "auth_insert_experiences" ON public.experiences_master FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'experience_bookings' AND policyname = 'auth_update_bookings') THEN
    CREATE POLICY "auth_update_bookings" ON public.experience_bookings FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

-- Realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.experience_alerts;

-- Triggers
CREATE TRIGGER update_experience_markup_rules_updated_at
  BEFORE UPDATE ON public.experience_markup_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_experience_customers_updated_at
  BEFORE UPDATE ON public.experience_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
