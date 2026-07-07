ALTER TABLE public.funding_morning_briefings
  ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS clients_total integer,
  ADD COLUMN IF NOT EXISTS clients_active integer,
  ADD COLUMN IF NOT EXISTS reminders_due_today integer,
  ADD COLUMN IF NOT EXISTS funding_received_mtd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS raw_data jsonb;

ALTER TABLE public.funding_morning_briefings
  ADD CONSTRAINT funding_morning_briefings_briefing_date_unique
  UNIQUE (briefing_date);