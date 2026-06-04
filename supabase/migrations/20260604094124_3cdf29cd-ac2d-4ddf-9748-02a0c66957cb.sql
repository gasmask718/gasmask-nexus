CREATE TABLE IF NOT EXISTS public.floor_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor text NOT NULL,
  section text,
  page_route text NOT NULL,
  page_name text NOT NULL,
  purpose text,
  status text NOT NULL CHECK (status IN ('ready','needs_work','stub','kill_pending','dormant')),
  gaps_count int NOT NULL DEFAULT 0,
  audit_pass text,
  last_audited timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_route)
);

GRANT SELECT ON public.floor_directory TO anon, authenticated;
GRANT ALL ON public.floor_directory TO service_role;

ALTER TABLE public.floor_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "floor_directory_read_all"
  ON public.floor_directory FOR SELECT
  USING (true);

CREATE POLICY "floor_directory_admin_write"
  ON public.floor_directory FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS floor_directory_floor_idx ON public.floor_directory(floor);
CREATE INDEX IF NOT EXISTS floor_directory_status_idx ON public.floor_directory(status);