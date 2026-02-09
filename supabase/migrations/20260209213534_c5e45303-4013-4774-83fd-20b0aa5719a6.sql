
-- Ambassador Recruitment Leads table
-- Governs the Lead → Invite → Ambassador pipeline
CREATE TYPE public.ambassador_lead_status AS ENUM (
  'new', 'contacted', 'qualified', 'invited', 'converted', 'dead'
);

CREATE TABLE public.ambassador_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  region TEXT,
  status public.ambassador_lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  invite_id UUID REFERENCES public.ambassador_invites(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ambassador_leads ENABLE ROW LEVEL SECURITY;

-- Ambassadors see only their own leads
CREATE POLICY "Ambassadors can view own leads"
  ON public.ambassador_leads FOR SELECT
  TO authenticated
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Ambassadors can insert own leads"
  ON public.ambassador_leads FOR INSERT
  TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Ambassadors can update own leads"
  ON public.ambassador_leads FOR UPDATE
  TO authenticated
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Ambassadors can delete own leads"
  ON public.ambassador_leads FOR DELETE
  TO authenticated
  USING (created_by_user_id = auth.uid());

-- Owner/Admin can see all leads for audit
CREATE POLICY "Admins can view all leads"
  ON public.ambassador_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Auto-update updated_at
CREATE TRIGGER update_ambassador_leads_updated_at
  BEFORE UPDATE ON public.ambassador_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_ambassador_leads_created_by ON public.ambassador_leads(created_by_user_id);
CREATE INDEX idx_ambassador_leads_status ON public.ambassador_leads(status);
CREATE INDEX idx_ambassador_leads_invite ON public.ambassador_leads(invite_id);
