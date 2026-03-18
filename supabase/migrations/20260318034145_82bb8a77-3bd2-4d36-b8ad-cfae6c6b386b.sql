
-- Add pipeline_stage to brandaro_qualified_leads
ALTER TABLE public.brandaro_qualified_leads
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'new';

-- Backfill pipeline_stage from existing lead_status
UPDATE public.brandaro_qualified_leads SET pipeline_stage = CASE
  WHEN lead_status IN ('sold') THEN 'closed'
  WHEN lead_status IN ('hot_lead') THEN 'interested'
  WHEN lead_status IN ('interested', 'send_info') THEN 'responded'
  WHEN lead_status IN ('calling', 'queued', 'no_answer', 'voicemail', 'callback') THEN 'contacted'
  WHEN lead_status IN ('not_interested', 'wrong_number', 'disqualified') THEN 'lost'
  ELSE 'new'
END;

-- Index for fast pipeline queries
CREATE INDEX IF NOT EXISTS idx_bql_pipeline_stage ON public.brandaro_qualified_leads(pipeline_stage);
