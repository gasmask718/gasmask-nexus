-- ═══════════════════════════ GODDESS IN YOU ═══════════════════════════
CREATE TABLE public.giy_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  first_name text,
  last_name text,
  phone text,
  email text,
  city text,
  state text,
  specialties text[] NOT NULL DEFAULT '{}',
  years_experience integer,
  portfolio_url text,
  lead_score integer NOT NULL DEFAULT 0,
  lead_source text,
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid,
  roster_profile_url text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.giy_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.giy_leads(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  actor text,
  content text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.giy_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.giy_leads(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL DEFAULT now(),
  channel text,
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.giy_leads TO authenticated;
GRANT ALL ON public.giy_leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.giy_interactions TO authenticated;
GRANT ALL ON public.giy_interactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.giy_followups TO authenticated;
GRANT ALL ON public.giy_followups TO service_role;

ALTER TABLE public.giy_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giy_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giy_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage giy_leads"
  ON public.giy_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage giy_interactions"
  ON public.giy_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage giy_followups"
  ON public.giy_followups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════ SERVICES.IO ═══════════════════════════
CREATE TABLE public.svc_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  first_name text,
  last_name text,
  phone text,
  email text,
  metro text,
  state text,
  service_categories text[] NOT NULL DEFAULT '{}',
  years_experience integer,
  license_status text,
  lead_score integer NOT NULL DEFAULT 0,
  lead_source text,
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid,
  provider_profile_url text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.svc_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.svc_leads(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  actor text,
  content text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.svc_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.svc_leads(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL DEFAULT now(),
  channel text,
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.svc_leads TO authenticated;
GRANT ALL ON public.svc_leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.svc_interactions TO authenticated;
GRANT ALL ON public.svc_interactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.svc_followups TO authenticated;
GRANT ALL ON public.svc_followups TO service_role;

ALTER TABLE public.svc_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.svc_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.svc_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage svc_leads"
  ON public.svc_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage svc_interactions"
  ON public.svc_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage svc_followups"
  ON public.svc_followups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- indexes
CREATE INDEX idx_giy_leads_status ON public.giy_leads(status);
CREATE INDEX idx_giy_leads_created_at ON public.giy_leads(created_at DESC);
CREATE INDEX idx_giy_interactions_lead ON public.giy_interactions(lead_id, occurred_at DESC);
CREATE INDEX idx_giy_followups_lead ON public.giy_followups(lead_id, due_at);
CREATE INDEX idx_svc_leads_status ON public.svc_leads(status);
CREATE INDEX idx_svc_leads_created_at ON public.svc_leads(created_at DESC);
CREATE INDEX idx_svc_interactions_lead ON public.svc_interactions(lead_id, occurred_at DESC);
CREATE INDEX idx_svc_followups_lead ON public.svc_followups(lead_id, due_at);

-- updated_at triggers (reuse existing helper)
CREATE TRIGGER update_giy_leads_updated_at BEFORE UPDATE ON public.giy_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_giy_followups_updated_at BEFORE UPDATE ON public.giy_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_svc_leads_updated_at BEFORE UPDATE ON public.svc_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_svc_followups_updated_at BEFORE UPDATE ON public.svc_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
