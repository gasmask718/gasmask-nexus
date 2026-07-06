-- Step 1A: Add missing columns to funding_clients
ALTER TABLE public.funding_clients
  ADD COLUMN IF NOT EXISTS stage text DEFAULT 'intake'
    CHECK (stage IN ('intake','credit_repair','credit_ready','funding_active','funded','grant_eligible','complete')),
  ADD COLUMN IF NOT EXISTS target_credit_score integer,
  ADD COLUMN IF NOT EXISTS score_tu integer,
  ADD COLUMN IF NOT EXISTS score_eq integer,
  ADD COLUMN IF NOT EXISTS score_ex integer,
  ADD COLUMN IF NOT EXISTS score_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS funding_target numeric,
  ADD COLUMN IF NOT EXISTS funding_received numeric DEFAULT 0;

-- Step 1B: client_notes
CREATE TABLE IF NOT EXISTS public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  note_type text DEFAULT 'general'
    CHECK (note_type IN ('general','credit','funding','grant','call','email','document','milestone')),
  title text,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_by text DEFAULT 'David',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cn_service ON public.client_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY cn_auth ON public.client_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS client_notes_client_id_idx ON public.client_notes(client_id);

-- Step 1C: client_reminders
CREATE TABLE IF NOT EXISTS public.client_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  reminder_type text DEFAULT 'task'
    CHECK (reminder_type IN ('task','follow_up','dispute_deadline','application_deadline','grant_deadline','call_scheduled','document_needed')),
  due_date date NOT NULL,
  due_time time,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  priority text DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_reminders TO authenticated;
GRANT ALL ON public.client_reminders TO service_role;
ALTER TABLE public.client_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_service ON public.client_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY cr_auth ON public.client_reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS client_reminders_client_id_idx ON public.client_reminders(client_id);
CREATE INDEX IF NOT EXISTS client_reminders_due_date_idx ON public.client_reminders(due_date) WHERE is_completed = false;

-- Step 1D: client_score_history
CREATE TABLE IF NOT EXISTS public.client_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  score_date date NOT NULL,
  score_tu integer,
  score_eq integer,
  score_ex integer,
  source text DEFAULT 'manual',
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, score_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_score_history TO authenticated;
GRANT ALL ON public.client_score_history TO service_role;
ALTER TABLE public.client_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY csh_service ON public.client_score_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY csh_auth ON public.client_score_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS client_score_history_client_id_idx ON public.client_score_history(client_id);