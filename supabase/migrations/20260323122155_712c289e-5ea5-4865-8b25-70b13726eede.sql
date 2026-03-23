
CREATE TABLE IF NOT EXISTS api_fetch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  source text NOT NULL,
  status_code int,
  error_message text,
  games_returned int DEFAULT 0
);

ALTER TABLE api_fetch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on api_fetch_logs"
  ON api_fetch_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read api_fetch_logs"
  ON api_fetch_logs FOR SELECT
  TO authenticated
  USING (true);
