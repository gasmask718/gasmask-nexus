
ALTER TABLE public.surplus_funds_leads
  ADD COLUMN IF NOT EXISTS call_recording_url text,
  ADD COLUMN IF NOT EXISTS call_transcript text,
  ADD COLUMN IF NOT EXISTS interest_level text,
  ADD COLUMN IF NOT EXISTS interest_score int,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS recommended_action text,
  ADD COLUMN IF NOT EXISTS callback_time text,
  ADD COLUMN IF NOT EXISTS dc_campaign_id uuid;

ALTER TABLE public.re_leads
  ADD COLUMN IF NOT EXISTS bland_call_id text,
  ADD COLUMN IF NOT EXISTS call_recording_url text,
  ADD COLUMN IF NOT EXISTS call_transcript text,
  ADD COLUMN IF NOT EXISTS interest_level text,
  ADD COLUMN IF NOT EXISTS interest_score int,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS recommended_action text,
  ADD COLUMN IF NOT EXISTS appointment_time text,
  ADD COLUMN IF NOT EXISTS seller_motivation_score int,
  ADD COLUMN IF NOT EXISTS dc_campaign_id uuid;
