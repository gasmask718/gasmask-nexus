
ALTER TABLE public.grant_business_profiles
  ADD COLUMN IF NOT EXISTS completeness_pct integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completeness_missing text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS doc_profit_loss boolean DEFAULT false;

UPDATE public.grant_business_profiles
SET completeness_pct = COALESCE(completeness_score, 0)
WHERE completeness_pct = 0 AND completeness_score IS NOT NULL;
