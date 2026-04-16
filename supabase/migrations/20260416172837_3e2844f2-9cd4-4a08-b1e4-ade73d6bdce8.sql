
ALTER TABLE public.brandaro_qualified_leads 
  ADD COLUMN IF NOT EXISTS last_dc_call_at timestamptz,
  ADD COLUMN IF NOT EXISTS dc_lead_quality text,
  ADD COLUMN IF NOT EXISTS dc_overall_score numeric;
