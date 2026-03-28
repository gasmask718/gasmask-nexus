-- Add Telegram identity fields to sbo_cappers
ALTER TABLE public.sbo_cappers
  ADD COLUMN IF NOT EXISTS telegram_user_id text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS confidence_grade text NOT NULL DEFAULT 'D',
  ADD COLUMN IF NOT EXISTS last_active timestamptz;

-- Unique constraint on telegram_user_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_sbo_cappers_telegram_user_id
  ON public.sbo_cappers (telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;