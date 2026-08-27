CREATE TYPE public.icw_job_status AS ENUM ('pending','matched','in_progress','complete','cancelled');

CREATE TABLE public.icw_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  state text,
  category_groups text[] NOT NULL DEFAULT '{}',
  license_status text NOT NULL DEFAULT 'unknown',
  availability text,
  approved boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icw_workers TO authenticated;
GRANT ALL ON public.icw_workers TO service_role;
ALTER TABLE public.icw_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage icw_workers" ON public.icw_workers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.icw_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_booking_id text,
  category text NOT NULL,
  sub_service text,
  state text,
  address text,
  scheduled_at timestamptz,
  status public.icw_job_status NOT NULL DEFAULT 'pending',
  assigned_worker_id uuid REFERENCES public.icw_workers(id) ON DELETE SET NULL,
  price numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX icw_jobs_external_booking_id_key ON public.icw_jobs (external_booking_id) WHERE external_booking_id IS NOT NULL;
CREATE INDEX icw_jobs_status_idx ON public.icw_jobs (status);
CREATE INDEX icw_jobs_scheduled_at_idx ON public.icw_jobs (scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icw_jobs TO authenticated;
GRANT ALL ON public.icw_jobs TO service_role;
ALTER TABLE public.icw_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage icw_jobs" ON public.icw_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.icw_state_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  tier text,
  priority_rank integer,
  snow_vertical boolean NOT NULL DEFAULT false,
  deli_oven_market_density text,
  handyman_license_gate text,
  specialty_license_gate text,
  verified boolean NOT NULL DEFAULT false,
  confidence text NOT NULL DEFAULT 'PENDING_VERIFICATION',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icw_state_config TO authenticated;
GRANT ALL ON public.icw_state_config TO service_role;
ALTER TABLE public.icw_state_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage icw_state_config" ON public.icw_state_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.icw_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.icw_jobs(id) ON DELETE CASCADE,
  event text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX icw_dispatch_log_job_id_idx ON public.icw_dispatch_log (job_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icw_dispatch_log TO authenticated;
GRANT ALL ON public.icw_dispatch_log TO service_role;
ALTER TABLE public.icw_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage icw_dispatch_log" ON public.icw_dispatch_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER icw_workers_updated_at BEFORE UPDATE ON public.icw_workers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER icw_jobs_updated_at BEFORE UPDATE ON public.icw_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER icw_state_config_updated_at BEFORE UPDATE ON public.icw_state_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.icw_state_config (state, confidence, verified, notes)
SELECT s, 'PENDING_VERIFICATION', false, 'Placeholder row — awaiting verified state data'
FROM unnest(ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']) AS s;