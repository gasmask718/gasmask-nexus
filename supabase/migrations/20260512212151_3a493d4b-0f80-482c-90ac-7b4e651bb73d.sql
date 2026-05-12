-- 1. Add 'pending' to store_status enum
ALTER TYPE store_status ADD VALUE IF NOT EXISTS 'pending';

-- 2. Add capture + approval columns to stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS captured_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS captured_role app_role,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS storefront_photo_url TEXT;

-- 3. Index for fast pending-queue queries
CREATE INDEX IF NOT EXISTS idx_stores_approval_pending
  ON public.stores(captured_at DESC)
  WHERE approval_status = 'pending';

-- 4. Backfill legacy rows
UPDATE public.stores
SET approval_status = 'approved'
WHERE approval_status IS NULL;