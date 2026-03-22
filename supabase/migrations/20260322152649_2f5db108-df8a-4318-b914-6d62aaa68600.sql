CREATE TABLE IF NOT EXISTS public.note_cleaner_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  total_records int DEFAULT 0,
  processed_records int DEFAULT 0,
  failed_records int DEFAULT 0,
  current_record text,
  results jsonb DEFAULT '[]'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.note_cleaner_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read jobs"
  ON public.note_cleaner_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert jobs"
  ON public.note_cleaner_jobs FOR INSERT TO authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.note_cleaner_jobs;