-- ── SLA snapshots ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_sla_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL,
  window_days int NOT NULL DEFAULT 30,
  p50_hours numeric,
  p90_hours numeric,
  shipped_count int NOT NULL DEFAULT 0,
  late_count int NOT NULL DEFAULT 0,
  late_threshold_hours numeric NOT NULL DEFAULT 72,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dd_sla_snapshots_supplier_idx ON public.dd_sla_snapshots (wholesaler_id, computed_at DESC);

GRANT SELECT ON public.dd_sla_snapshots TO authenticated;
GRANT ALL ON public.dd_sla_snapshots TO service_role;

ALTER TABLE public.dd_sla_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read sla snapshots" ON public.dd_sla_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Anomaly findings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_anomaly_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  kind text NOT NULL,                   -- 'spike' | 'duplicate_cluster' | 'geo' | 'other'
  severity text NOT NULL DEFAULT 'info',-- 'info' | 'warn' | 'critical'
  title text NOT NULL,
  summary text,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',  -- 'open' | 'reviewed' | 'dismissed'
  ai_generated boolean NOT NULL DEFAULT true,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dd_anomaly_findings_status_idx ON public.dd_anomaly_findings (status, scan_date DESC);

GRANT SELECT, UPDATE ON public.dd_anomaly_findings TO authenticated;
GRANT ALL ON public.dd_anomaly_findings TO service_role;

ALTER TABLE public.dd_anomaly_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read anomaly findings" ON public.dd_anomaly_findings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update anomaly findings" ON public.dd_anomaly_findings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));