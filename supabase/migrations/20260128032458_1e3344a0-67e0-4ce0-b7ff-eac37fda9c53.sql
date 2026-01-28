
-- Fix pipeline_stage constraint to allow all stages used in the UI
ALTER TABLE public.sales_prospects
DROP CONSTRAINT IF EXISTS sales_prospects_pipeline_stage_check;

-- Add all stages used by the ambassador leads system (lowercase for DB storage)
ALTER TABLE public.sales_prospects
ADD CONSTRAINT sales_prospects_pipeline_stage_check
CHECK (pipeline_stage IN (
  -- Store stages
  'new', 'contacted', 'meeting set', 'proposal', 'negotiation', 'won', 'lost',
  -- Wholesaler stages  
  'identified', 'reached out', 'qualified', 'onboarding', 'active',
  -- Influencer stages
  'interested', 'training',
  -- Ambassador stages
  'applied', 'screening', 'interview', 'background check',
  -- Legacy stages
  'follow-up', 'activated', 'closed-lost'
));

-- Fix source constraint to allow ambassador referral sources
ALTER TABLE public.sales_prospects
DROP CONSTRAINT IF EXISTS sales_prospects_source_check;

ALTER TABLE public.sales_prospects
ADD CONSTRAINT sales_prospects_source_check
CHECK (source IN (
  'walk-in', 'instagram', 'referral', 'cold-call', 'event',
  'ambassador_referral', 'store_referral', 'wholesaler_referral',
  'influencer_referral', 'ambassador', 'website', 'social_media',
  'trade_show', 'word_of_mouth', 'other'
));
