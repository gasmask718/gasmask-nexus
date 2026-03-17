
-- Enable pg_cron and pg_net extensions if not already
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add lead_phone column to closer sessions for recovery SMS
ALTER TABLE public.brandaro_closer_sessions 
  ADD COLUMN IF NOT EXISTS lead_phone TEXT;
