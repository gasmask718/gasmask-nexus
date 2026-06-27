
CREATE TABLE IF NOT EXISTS public.partner_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  partner_id UUID NOT NULL,
  partner_type TEXT NOT NULL,
  partner_name TEXT,

  dispatches_received_30d INT DEFAULT 0,
  dispatches_accepted_30d INT DEFAULT 0,
  dispatches_declined_30d INT DEFAULT 0,
  dispatches_no_response_30d INT DEFAULT 0,
  acceptance_rate_30d NUMERIC(5,2) DEFAULT 0,
  avg_response_time_minutes_30d NUMERIC(10,2),

  bookings_accepted_30d INT DEFAULT 0,
  bookings_completed_30d INT DEFAULT 0,
  bookings_cancelled_30d INT DEFAULT 0,
  completion_rate_30d NUMERIC(5,2) DEFAULT 0,

  customer_ratings_count_30d INT DEFAULT 0,
  customer_ratings_avg_30d NUMERIC(3,2),
  partner_ratings_count_30d INT DEFAULT 0,
  partner_ratings_avg_30d NUMERIC(3,2),
  flags_received_30d INT DEFAULT 0,

  revenue_generated_30d NUMERIC(12,2) DEFAULT 0,
  payout_earned_30d NUMERIC(12,2) DEFAULT 0,
  tips_received_30d NUMERIC(12,2) DEFAULT 0,

  performance_tier TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (snapshot_date, partner_id)
);

GRANT SELECT ON public.partner_performance_snapshots TO authenticated;
GRANT ALL ON public.partner_performance_snapshots TO service_role;

ALTER TABLE public.partner_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_partner_snapshots_partner
  ON public.partner_performance_snapshots(partner_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_partner_snapshots_tier
  ON public.partner_performance_snapshots(performance_tier, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_partner_snapshots_date
  ON public.partner_performance_snapshots(snapshot_date DESC);

CREATE POLICY "Admins view all partner snapshots"
ON public.partner_performance_snapshots FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('admin','owner'))
);

CREATE POLICY "Partners view own snapshots"
ON public.partner_performance_snapshots FOR SELECT
TO authenticated
USING (
  partner_id IN (SELECT id FROM public.tt_partners WHERE user_id = auth.uid())
  OR partner_id IN (SELECT id FROM public.decorators WHERE user_id = auth.uid())
);
