-- Create product_velocity_ratio_baseline table
CREATE TABLE public.product_velocity_ratio_baseline (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid REFERENCES public.production_offices(id),
  baseline_ratio numeric NOT NULL DEFAULT 1,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(office_id)
);

ALTER TABLE public.product_velocity_ratio_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read velocity baselines"
  ON public.product_velocity_ratio_baseline FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can write velocity baselines"
  ON public.product_velocity_ratio_baseline FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Create allocation_run_logs table
CREATE TABLE public.allocation_run_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid,
  total_lbs numeric,
  total_reserved numeric,
  unallocated_pct numeric,
  divergence_ratio numeric,
  alerts_fired integer NOT NULL DEFAULT 0,
  survival_floor_enforced boolean NOT NULL DEFAULT false,
  run_timestamp timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allocation_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read allocation run logs"
  ON public.allocation_run_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can insert allocation run logs"
  ON public.allocation_run_logs FOR INSERT
  TO service_role WITH CHECK (true);