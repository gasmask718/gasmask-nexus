-- Fix 1: Allow ambassadors to be created as recruits without a user account yet
ALTER TABLE public.ambassadors ALTER COLUMN user_id DROP NOT NULL;

-- Fix 2: Add 'street_team' and 'other' to valid platform values for influencers
ALTER TABLE public.influencers DROP CONSTRAINT influencers_platform_check;
ALTER TABLE public.influencers ADD CONSTRAINT influencers_platform_check 
  CHECK (platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text, 'twitter'::text, 'facebook'::text, 'street_team'::text, 'other'::text]));