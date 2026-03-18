CREATE TABLE IF NOT EXISTS brandaro_event_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  event_type text NOT NULL,
  message_content text,
  error_message text,
  retry_count int DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_event_failures_status ON brandaro_event_failures(status) WHERE status = 'pending';