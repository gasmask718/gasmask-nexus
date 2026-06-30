ALTER TABLE public.dnc_list
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS business TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_dnc_list_business ON public.dnc_list(business);
CREATE INDEX IF NOT EXISTS idx_dnc_list_source ON public.dnc_list(source);