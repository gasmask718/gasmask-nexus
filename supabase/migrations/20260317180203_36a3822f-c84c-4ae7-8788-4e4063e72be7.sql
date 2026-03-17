ALTER TABLE public.brandaro_close_pipeline
  ADD COLUMN IF NOT EXISTS payment_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS revenue_amount NUMERIC DEFAULT 0;

ALTER TABLE public.brandaro_followup_sequences
  ADD COLUMN IF NOT EXISTS voice_call_id UUID;