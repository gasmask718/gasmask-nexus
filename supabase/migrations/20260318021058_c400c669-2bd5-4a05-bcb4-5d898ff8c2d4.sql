
CREATE TABLE public.brandaro_lead_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outscraper_request_id text,
  search_query text NOT NULL,
  location text NOT NULL,
  lead_limit int DEFAULT 50,
  status text NOT NULL DEFAULT 'pending',
  total_received int DEFAULT 0,
  inserted_count int DEFAULT 0,
  duplicate_count int DEFAULT 0,
  no_website_count int DEFAULT 0,
  error_message text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.brandaro_lead_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead jobs"
  ON public.brandaro_lead_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lead jobs"
  ON public.brandaro_lead_jobs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update lead jobs"
  ON public.brandaro_lead_jobs FOR UPDATE TO authenticated USING (true);

-- Allow anon/service role for webhook updates
CREATE POLICY "Service can update lead jobs"
  ON public.brandaro_lead_jobs FOR UPDATE TO anon USING (true);
