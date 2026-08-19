ALTER TABLE public.dynasty_ai_calls
  ADD COLUMN IF NOT EXISTS answered_by text,
  ADD COLUMN IF NOT EXISTS call_ended_by text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_synced_at timestamptz;

CREATE TABLE IF NOT EXISTS public.bland_call_mirror (
  call_id text PRIMARY KEY,
  price numeric,
  answered_by text,
  call_ended_by text,
  from_number text,
  to_number text,
  inbound boolean,
  call_length numeric,
  status text,
  recording_url text,
  raw jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bland_call_mirror TO authenticated;
GRANT ALL ON public.bland_call_mirror TO service_role;
ALTER TABLE public.bland_call_mirror ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read bland call mirror" ON public.bland_call_mirror;
CREATE POLICY "Authenticated can read bland call mirror"
  ON public.bland_call_mirror FOR SELECT TO authenticated USING (true);