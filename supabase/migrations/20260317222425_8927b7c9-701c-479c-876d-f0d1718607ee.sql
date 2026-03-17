
-- Add sample/exposure/conversion tracking to offer_variants
ALTER TABLE brandaro_offer_variants
  ADD COLUMN IF NOT EXISTS sample_size integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exposure_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_count integer DEFAULT 0;

-- Add exposure/conversion tracking to pricing_tests
ALTER TABLE brandaro_pricing_tests
  ADD COLUMN IF NOT EXISTS exposure_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_count integer DEFAULT 0;

-- Decision log for idempotency + audit trail
CREATE TABLE IF NOT EXISTS brandaro_system_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid UNIQUE NOT NULL,
  decision_type text NOT NULL,
  decision_reason text,
  action_taken text NOT NULL,
  impact_score numeric DEFAULT 0,
  input_snapshot jsonb DEFAULT '{}',
  output_snapshot jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_decisions_request ON brandaro_system_decisions(request_id);
CREATE INDEX IF NOT EXISTS idx_system_decisions_type ON brandaro_system_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_system_decisions_created ON brandaro_system_decisions(created_at);

ALTER TABLE brandaro_system_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read decisions" ON brandaro_system_decisions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert decisions" ON brandaro_system_decisions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime for decisions
ALTER PUBLICATION supabase_realtime ADD TABLE brandaro_system_decisions;
