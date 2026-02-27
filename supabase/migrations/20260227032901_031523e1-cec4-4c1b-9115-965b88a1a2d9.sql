
-- Dialer Intelligence Integrity Panel tables

-- Run status enum
CREATE TYPE public.intelligence_run_status AS ENUM ('ok', 'warn', 'error');
CREATE TYPE public.intelligence_step_status AS ENUM ('ok', 'warn', 'error', 'skipped');
CREATE TYPE public.intelligence_run_mode AS ENUM ('dry_run', 'live');

-- 1. Main runs table
CREATE TABLE public.dialer_intelligence_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  engine_cycle_id uuid NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  run_mode intelligence_run_mode NOT NULL DEFAULT 'live',
  overall_status intelligence_run_status NOT NULL DEFAULT 'ok',
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Per-step records
CREATE TABLE public.dialer_intelligence_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.dialer_intelligence_runs(id) ON DELETE CASCADE,
  step_name text NOT NULL,
  rpc_name text NOT NULL,
  status intelligence_step_status NOT NULL DEFAULT 'skipped',
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  duration_ms int DEFAULT 0,
  rows_affected int DEFAULT 0,
  error_code text NULL,
  error_message text NULL,
  output_json jsonb NULL
);

-- 3. Delta snapshots
CREATE TABLE public.dialer_intelligence_deltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.dialer_intelligence_runs(id) ON DELETE CASCADE,
  queue_priority_rows_changed int DEFAULT 0,
  queue_priority_avg_delta numeric DEFAULT 0,
  queue_priority_max_delta numeric DEFAULT 0,
  campaign_weights_changed int DEFAULT 0,
  campaign_weight_avg_delta numeric DEFAULT 0,
  inventory_seed_inserted int DEFAULT 0,
  inventory_seed_updated int DEFAULT 0,
  inventory_seed_blocked int DEFAULT 0,
  agent_routing_top_rep_share numeric DEFAULT 0,
  agent_routing_gini numeric NULL,
  notes jsonb NULL
);

-- RLS
ALTER TABLE public.dialer_intelligence_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialer_intelligence_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialer_intelligence_deltas ENABLE ROW LEVEL SECURITY;

-- Admin/owner read access
CREATE POLICY "Admin read intelligence runs"
  ON public.dialer_intelligence_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admin read intelligence steps"
  ON public.dialer_intelligence_run_steps FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dialer_intelligence_runs r
    WHERE r.id = run_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  ));

CREATE POLICY "Admin read intelligence deltas"
  ON public.dialer_intelligence_deltas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dialer_intelligence_runs r
    WHERE r.id = run_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  ));

-- Service role insert (edge functions write these)
CREATE POLICY "Service insert intelligence runs"
  ON public.dialer_intelligence_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Service insert intelligence steps"
  ON public.dialer_intelligence_run_steps FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dialer_intelligence_runs r
    WHERE r.id = run_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  ));

CREATE POLICY "Service insert intelligence deltas"
  ON public.dialer_intelligence_deltas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dialer_intelligence_runs r
    WHERE r.id = run_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  ));

-- Indexes
CREATE INDEX idx_intelligence_runs_business ON public.dialer_intelligence_runs(business_id, started_at DESC);
CREATE INDEX idx_intelligence_steps_run ON public.dialer_intelligence_run_steps(run_id);
CREATE INDEX idx_intelligence_deltas_run ON public.dialer_intelligence_deltas(run_id);
