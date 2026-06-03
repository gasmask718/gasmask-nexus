-- The previous WHERE dedupe_key IS NOT NULL partial index excludes NULL rows,
-- so PostgREST can't resolve onConflict=dedupe_key when the value is NULL
-- (Postgres treats NULLs as distinct by default — multiple NULLs allowed).
-- Drop the partial and replace with a plain unique index covering all rows.
DROP INDEX IF EXISTS public.dialer_call_events_dedupe_key_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS dialer_call_events_dedupe_key_uidx
  ON public.dialer_call_events (dedupe_key);