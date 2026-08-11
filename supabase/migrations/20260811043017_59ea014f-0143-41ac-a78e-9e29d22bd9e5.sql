CREATE TABLE public.clipper_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  follower_ranges jsonb NOT NULL DEFAULT '{}'::jsonb,
  why_join text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clipper_applications_status ON public.clipper_applications (status, created_at DESC);

GRANT INSERT ON public.clipper_applications TO anon;
GRANT SELECT, INSERT, UPDATE ON public.clipper_applications TO authenticated;
GRANT ALL ON public.clipper_applications TO service_role;

ALTER TABLE public.clipper_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a clipper application"
  ON public.clipper_applications FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view clipper applications"
  ON public.clipper_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Staff can update clipper applications"
  ON public.clipper_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_clipper_applications_updated_at
  BEFORE UPDATE ON public.clipper_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();