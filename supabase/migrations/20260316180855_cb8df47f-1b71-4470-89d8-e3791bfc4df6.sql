ALTER TABLE public.call_recordings 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'initiated',
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS from_number text,
  ADD COLUMN IF NOT EXISTS to_number text;