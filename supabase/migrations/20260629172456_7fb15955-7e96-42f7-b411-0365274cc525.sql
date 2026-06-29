ALTER TABLE public.dd_grabba_sync
  ADD COLUMN IF NOT EXISTS supplier_notified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_notified_at timestamptz;