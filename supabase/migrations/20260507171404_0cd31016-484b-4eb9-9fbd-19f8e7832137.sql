
-- 1. Master product catalogue
CREATE TABLE IF NOT EXISTS public.brandaro_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'service',
  product_type text NOT NULL DEFAULT 'one_time' CHECK (product_type IN ('one_time','recurring','addon')),
  billing_interval text CHECK (billing_interval IN ('monthly','quarterly','yearly') OR billing_interval IS NULL),
  price numeric(10,2) NOT NULL DEFAULT 0,
  setup_fee numeric(10,2) DEFAULT 0,
  monthly_obligations jsonb NOT NULL DEFAULT '[]'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brandaro_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read products" ON public.brandaro_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage products" ON public.brandaro_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Client products (active services)
CREATE TABLE IF NOT EXISTS public.brandaro_client_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  lead_id uuid REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.brandaro_products(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','pending')),
  price_override numeric(10,2),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  next_billing_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bcp_lead ON public.brandaro_client_products(lead_id);
CREATE INDEX IF NOT EXISTS idx_bcp_client ON public.brandaro_client_products(client_id);
ALTER TABLE public.brandaro_client_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage client products" ON public.brandaro_client_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Client invoices
CREATE TABLE IF NOT EXISTS public.brandaro_client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL DEFAULT ('BRN-' || to_char(now(),'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  client_id uuid,
  lead_id uuid REFERENCES public.brandaro_leads_master(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','void','refunded')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  stripe_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bci_lead ON public.brandaro_client_invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_bci_status ON public.brandaro_client_invoices(status);
ALTER TABLE public.brandaro_client_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage invoices" ON public.brandaro_client_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Invoice line items
CREATE TABLE IF NOT EXISTS public.brandaro_client_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.brandaro_client_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.brandaro_products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bcii_invoice ON public.brandaro_client_invoice_items(invoice_id);
ALTER TABLE public.brandaro_client_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage invoice items" ON public.brandaro_client_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Maintenance tasks (master feed for PMs/VAs)
CREATE TABLE IF NOT EXISTS public.brandaro_maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  lead_id uuid REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE,
  client_product_id uuid REFERENCES public.brandaro_client_products(id) ON DELETE SET NULL,
  task_type text NOT NULL CHECK (task_type IN ('monthly_deliverable','change_request','billing_alert','ai_upsell','manual')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','dismissed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_date date,
  assigned_to uuid,
  ai_generated boolean NOT NULL DEFAULT false,
  ai_reasoning text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bmt_lead ON public.brandaro_maintenance_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_bmt_status ON public.brandaro_maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_bmt_type ON public.brandaro_maintenance_tasks(task_type);
ALTER TABLE public.brandaro_maintenance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage maintenance tasks" ON public.brandaro_maintenance_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Upsell opportunities (sales pipeline per client)
CREATE TABLE IF NOT EXISTS public.brandaro_upsell_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  lead_id uuid REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.brandaro_products(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'suggested' CHECK (stage IN ('suggested','offered','accepted','declined')),
  reasoning text,
  estimated_value numeric(10,2),
  ai_generated boolean NOT NULL DEFAULT false,
  offered_at timestamptz,
  responded_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buo_lead ON public.brandaro_upsell_opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_buo_stage ON public.brandaro_upsell_opportunities(stage);
ALTER TABLE public.brandaro_upsell_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage upsell" ON public.brandaro_upsell_opportunities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Updated-at triggers (reuse existing function if present)
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.brandaro_touch_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $f$
  BEGIN NEW.updated_at = now(); RETURN NEW; END $f$;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bp_touch') THEN
    CREATE TRIGGER trg_bp_touch BEFORE UPDATE ON public.brandaro_products
      FOR EACH ROW EXECUTE FUNCTION public.brandaro_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bcp_touch') THEN
    CREATE TRIGGER trg_bcp_touch BEFORE UPDATE ON public.brandaro_client_products
      FOR EACH ROW EXECUTE FUNCTION public.brandaro_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bci_touch') THEN
    CREATE TRIGGER trg_bci_touch BEFORE UPDATE ON public.brandaro_client_invoices
      FOR EACH ROW EXECUTE FUNCTION public.brandaro_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bmt_touch') THEN
    CREATE TRIGGER trg_bmt_touch BEFORE UPDATE ON public.brandaro_maintenance_tasks
      FOR EACH ROW EXECUTE FUNCTION public.brandaro_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_buo_touch') THEN
    CREATE TRIGGER trg_buo_touch BEFORE UPDATE ON public.brandaro_upsell_opportunities
      FOR EACH ROW EXECUTE FUNCTION public.brandaro_touch_updated_at();
  END IF;
END $$;

-- 8. Seed core product catalogue
INSERT INTO public.brandaro_products (sku, name, description, category, product_type, billing_interval, price, setup_fee, monthly_obligations, features, sort_order)
VALUES
  ('BRN-WEB-STARTER', 'Starter Website', '5-page custom website with mobile design and basic SEO setup.', 'website', 'one_time', NULL, 1497, 0,
   '[]'::jsonb,
   '["5 custom pages","Mobile responsive","Basic on-page SEO","Contact form","1 round of revisions"]'::jsonb, 10),
  ('BRN-WEB-GROWTH', 'Growth Website', '10-page conversion-focused website with booking + lead capture.', 'website', 'one_time', NULL, 2997, 0,
   '[]'::jsonb,
   '["10 pages","Booking integration","Lead magnets","CRM integration","2 rounds of revisions"]'::jsonb, 20),
  ('BRN-WEB-EMPIRE', 'Empire Website', 'Full custom funnel build with automations and AI chat.', 'website', 'one_time', NULL, 4997, 0,
   '[]'::jsonb,
   '["Unlimited pages","Custom funnels","AI chatbot","Email automations","Priority support"]'::jsonb, 30),
  ('BRN-MAINT-CORE', 'Core Maintenance', 'Monthly site maintenance, hosting, and security.', 'maintenance', 'recurring', 'monthly', 197, 0,
   '[{"label":"Hosting + uptime monitoring","cadence":"monthly"},{"label":"Plugin & security updates","cadence":"monthly"},{"label":"Daily backups","cadence":"daily"},{"label":"2 small content edits","cadence":"monthly"}]'::jsonb,
   '["99.9% uptime SLA","SSL renewal","Malware scans"]'::jsonb, 40),
  ('BRN-SEO-LOCAL', 'Local SEO', 'Local search optimization, GMB, citations, and reporting.', 'seo', 'recurring', 'monthly', 497, 497,
   '[{"label":"GMB optimization","cadence":"monthly"},{"label":"Citation building","cadence":"monthly"},{"label":"Keyword tracking report","cadence":"monthly"},{"label":"1 SEO blog post","cadence":"monthly"}]'::jsonb,
   '["Google Business Profile","Local citations","Rank tracking","Monthly report"]'::jsonb, 50),
  ('BRN-ADS-MGMT', 'Paid Ads Management', 'Google + Meta ads management.', 'ads', 'recurring', 'monthly', 797, 297,
   '[{"label":"Campaign optimization","cadence":"weekly"},{"label":"Creative refresh","cadence":"monthly"},{"label":"Performance report","cadence":"monthly"}]'::jsonb,
   '["Google Ads","Meta Ads","Pixel + tracking","Monthly creative"]'::jsonb, 60),
  ('BRN-SOCIAL', 'Social Media Management', 'Content + posting on IG, FB, TikTok.', 'social', 'recurring', 'monthly', 597, 0,
   '[{"label":"12 posts","cadence":"monthly"},{"label":"4 reels","cadence":"monthly"},{"label":"Community replies","cadence":"weekly"}]'::jsonb,
   '["3 platforms","Content calendar","Branded graphics"]'::jsonb, 70),
  ('BRN-AI-CHAT', 'AI Chat Agent', 'AI receptionist for website + SMS.', 'ai', 'recurring', 'monthly', 297, 497,
   '[{"label":"Bot training refresh","cadence":"monthly"},{"label":"Conversation review","cadence":"monthly"}]'::jsonb,
   '["Website widget","SMS handoff","Booking integration"]'::jsonb, 80)
ON CONFLICT (sku) DO NOTHING;
