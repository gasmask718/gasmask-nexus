-- Drop the partial unique index that PostgREST can't use for upsert
DROP INDEX IF EXISTS idx_call_recordings_provider_sid;

-- Create a proper unique constraint that PostgREST can use
ALTER TABLE public.call_recordings ADD CONSTRAINT call_recordings_provider_call_sid_key UNIQUE (provider_call_sid);