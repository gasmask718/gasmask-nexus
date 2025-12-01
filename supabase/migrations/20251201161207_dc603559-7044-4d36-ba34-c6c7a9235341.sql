CREATE TABLE public.store_extracted_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  personal_profile JSONB DEFAULT '{}'::jsonb,
  operational_profile JSONB DEFAULT '{}'::jsonb,
  red_flags JSONB DEFAULT '{"notes": []}'::jsonb,
  opportunities JSONB DEFAULT '{"notes": []}'::jsonb,
  last_extracted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  source_notes_count INTEGER DEFAULT 0,
  raw_snapshot_hash TEXT,
  extraction_confidence NUMERIC(3,2) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_extracted_profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_store_profiles_store_id ON public.store_extracted_profiles(store_id);