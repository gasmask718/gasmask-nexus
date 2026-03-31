
-- Add missing columns if table already exists
DO $$ 
BEGIN
  -- Add columns that might be missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unforgettable_ambassadors' AND column_name = 'instagram_handle') THEN
    ALTER TABLE unforgettable_ambassadors ADD COLUMN instagram_handle TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unforgettable_ambassadors' AND column_name = 'tiktok_handle') THEN
    ALTER TABLE unforgettable_ambassadors ADD COLUMN tiktok_handle TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unforgettable_ambassadors' AND column_name = 'youtube_handle') THEN
    ALTER TABLE unforgettable_ambassadors ADD COLUMN youtube_handle TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unforgettable_ambassadors' AND column_name = 'why_ambassador') THEN
    ALTER TABLE unforgettable_ambassadors ADD COLUMN why_ambassador TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unforgettable_ambassadors' AND column_name = 'follower_range') THEN
    ALTER TABLE unforgettable_ambassadors ADD COLUMN follower_range TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unforgettable_ambassadors' AND column_name = 'event_types') THEN
    ALTER TABLE unforgettable_ambassadors ADD COLUMN event_types TEXT[];
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE unforgettable_ambassadors ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure correctness
DROP POLICY IF EXISTS "Authenticated users can read UT ambassadors" ON unforgettable_ambassadors;
DROP POLICY IF EXISTS "Service role can insert UT ambassadors" ON unforgettable_ambassadors;
DROP POLICY IF EXISTS "Service role can update UT ambassadors" ON unforgettable_ambassadors;
DROP POLICY IF EXISTS "Anon can insert UT ambassadors" ON unforgettable_ambassadors;

CREATE POLICY "Authenticated users can read UT ambassadors"
ON unforgettable_ambassadors FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Service role can insert UT ambassadors"
ON unforgettable_ambassadors FOR INSERT
TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update UT ambassadors"
ON unforgettable_ambassadors FOR UPDATE
TO service_role USING (true);

-- Allow anon inserts for public application form
CREATE POLICY "Anon can insert UT ambassadors"
ON unforgettable_ambassadors FOR INSERT
TO anon WITH CHECK (true);
