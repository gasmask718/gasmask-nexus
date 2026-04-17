ALTER TABLE public.dynasty_call_history
  ADD COLUMN IF NOT EXISTS business_type TEXT;

CREATE INDEX IF NOT EXISTS idx_dynasty_call_history_business_type
  ON public.dynasty_call_history(business_type);

UPDATE public.dynasty_call_history h
SET business_type = q.business_type
FROM public.dynasty_call_queue q
WHERE h.call_id = q.bland_call_id
  AND h.business_type IS NULL
  AND q.business_type IS NOT NULL;