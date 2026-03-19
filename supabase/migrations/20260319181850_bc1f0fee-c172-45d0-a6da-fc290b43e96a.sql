CREATE TABLE IF NOT EXISTS brandaro_discovery_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  search_query TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  industry TEXT NOT NULL,
  radius_meters INTEGER DEFAULT 40000,
  status TEXT DEFAULT 'queued',
  total_found INTEGER DEFAULT 0,
  no_website_count INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  skipped_duplicates INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brandaro_qualified_leads
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS discovery_job_id UUID,
ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
ADD COLUMN IF NOT EXISTS has_website BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_leads_place_id ON brandaro_qualified_leads(google_place_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON brandaro_qualified_leads(phone_number);

CREATE OR REPLACE FUNCTION validate_discovery_job_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('queued', 'running', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_discovery_job_status ON brandaro_discovery_jobs;
CREATE TRIGGER trg_validate_discovery_job_status
  BEFORE INSERT OR UPDATE ON brandaro_discovery_jobs
  FOR EACH ROW EXECUTE FUNCTION validate_discovery_job_status();

ALTER TABLE brandaro_discovery_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage discovery jobs"
  ON brandaro_discovery_jobs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);