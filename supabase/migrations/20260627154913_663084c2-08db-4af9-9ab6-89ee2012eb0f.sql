CREATE TABLE IF NOT EXISTS public.partner_blackout_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.tt_partners(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_blackout_dates TO authenticated;
GRANT ALL ON public.partner_blackout_dates TO service_role;

ALTER TABLE public.partner_blackout_dates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_partner_blackouts_dates
  ON public.partner_blackout_dates(partner_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_partner_blackouts_lookup
  ON public.partner_blackout_dates(start_date, end_date);

CREATE POLICY "Partners manage own blackouts"
  ON public.partner_blackout_dates FOR ALL TO authenticated
  USING (partner_id IN (SELECT id FROM public.tt_partners WHERE user_id = auth.uid()))
  WITH CHECK (partner_id IN (SELECT id FROM public.tt_partners WHERE user_id = auth.uid()));

CREATE POLICY "Admins read all partner blackouts"
  ON public.partner_blackout_dates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));