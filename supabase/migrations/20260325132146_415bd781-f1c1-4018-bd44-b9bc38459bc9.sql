CREATE TABLE IF NOT EXISTS public.solar_outreach_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  phone text,
  address text,
  state text,
  source text DEFAULT 'manual',
  outreach_status text DEFAULT 'new',
  last_contacted timestamptz,
  call_attempts integer DEFAULT 0,
  last_call_outcome text,
  estimated_bill numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.solar_outreach_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view outreach contacts"
  ON public.solar_outreach_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert outreach contacts"
  ON public.solar_outreach_contacts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update outreach contacts"
  ON public.solar_outreach_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_outreach_status ON public.solar_outreach_contacts(outreach_status);
CREATE INDEX idx_outreach_state ON public.solar_outreach_contacts(state);