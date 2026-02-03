
-- ============================================================
-- PHASE 1: Add ownership columns to influencers table
-- ============================================================

-- Add ambassador_id column (nullable for backward compatibility with existing rows)
ALTER TABLE public.influencers 
ADD COLUMN IF NOT EXISTS ambassador_id uuid REFERENCES public.ambassadors(id);

-- Add created_by column to track who created the record
ALTER TABLE public.influencers 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_influencers_ambassador_id ON public.influencers(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_influencers_created_by ON public.influencers(created_by);

-- ============================================================
-- PHASE 2: Update current_ambassador_id() helper function
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_ambassador_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.ambassadors 
  WHERE user_id = auth.uid() 
    AND is_active = true 
  LIMIT 1
$$;

-- ============================================================
-- PHASE 3: Add RLS policies for ambassadors on influencers
-- ============================================================

-- Drop existing policies to recreate cleanly
DROP POLICY IF EXISTS "Admins can manage influencers" ON public.influencers;
DROP POLICY IF EXISTS "Anyone can view influencers" ON public.influencers;
DROP POLICY IF EXISTS "Ambassadors can view their influencers" ON public.influencers;
DROP POLICY IF EXISTS "Ambassadors can insert their influencers" ON public.influencers;
DROP POLICY IF EXISTS "Ambassadors can update their influencers" ON public.influencers;
DROP POLICY IF EXISTS "Owner full access to influencers" ON public.influencers;

-- Owner/Admin full access
CREATE POLICY "Owner full access to influencers"
ON public.influencers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('owner', 'admin')
  )
);

-- Ambassadors can SELECT their own influencers (via ambassador_id OR assignment)
CREATE POLICY "Ambassadors can view their influencers"
ON public.influencers
FOR SELECT
USING (
  -- Direct ownership
  ambassador_id = public.current_ambassador_id()
  OR
  -- Via assignment table (existing pattern)
  EXISTS (
    SELECT 1 FROM public.influencer_assignments ia
    WHERE ia.influencer_id = influencers.id
    AND ia.ambassador_id = public.current_ambassador_id()
    AND ia.active = true
  )
  OR
  -- Legacy: allow viewing influencers without ambassador_id (for admins/general view)
  ambassador_id IS NULL
);

-- Ambassadors can INSERT their own influencers
CREATE POLICY "Ambassadors can insert their influencers"
ON public.influencers
FOR INSERT
WITH CHECK (
  -- Must set ambassador_id to current ambassador
  ambassador_id = public.current_ambassador_id()
  AND
  -- Must set created_by to current user
  created_by = auth.uid()
  AND
  -- User must be an ambassador
  public.current_ambassador_id() IS NOT NULL
);

-- Ambassadors can UPDATE their own influencers
CREATE POLICY "Ambassadors can update their influencers"
ON public.influencers
FOR UPDATE
USING (
  ambassador_id = public.current_ambassador_id()
  OR
  EXISTS (
    SELECT 1 FROM public.influencer_assignments ia
    WHERE ia.influencer_id = influencers.id
    AND ia.ambassador_id = public.current_ambassador_id()
    AND ia.active = true
  )
)
WITH CHECK (
  ambassador_id = public.current_ambassador_id()
  OR
  EXISTS (
    SELECT 1 FROM public.influencer_assignments ia
    WHERE ia.influencer_id = influencers.id
    AND ia.ambassador_id = public.current_ambassador_id()
    AND ia.active = true
  )
);

-- No DELETE for ambassadors (admin only via full access policy)
