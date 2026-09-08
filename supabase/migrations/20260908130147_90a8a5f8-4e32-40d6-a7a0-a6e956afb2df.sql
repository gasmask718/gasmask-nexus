CREATE TABLE IF NOT EXISTS public.hw_geocode_staging (
  lead_id uuid PRIMARY KEY,
  lat numeric NOT NULL,
  long numeric NOT NULL,
  matched_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hw_geocode_staging TO authenticated;
GRANT ALL ON public.hw_geocode_staging TO service_role;
ALTER TABLE public.hw_geocode_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hw_geocode_staging admin manage" ON public.hw_geocode_staging FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));