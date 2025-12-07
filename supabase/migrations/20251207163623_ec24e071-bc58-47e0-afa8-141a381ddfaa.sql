
-- Store Notes table for personal insights about stores
CREATE TABLE IF NOT EXISTS public.store_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Store Status History for timeline of actions
CREATE TABLE IF NOT EXISTS public.store_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.store_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for store_notes
CREATE POLICY "Anyone can view store notes" ON public.store_notes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create store notes" ON public.store_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own notes" ON public.store_notes FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own notes" ON public.store_notes FOR DELETE USING (true);

-- RLS policies for store_status_history
CREATE POLICY "Anyone can view store status history" ON public.store_status_history FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create status history" ON public.store_status_history FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_notes_store_id ON public.store_notes(store_id);
CREATE INDEX IF NOT EXISTS idx_store_status_history_store_id ON public.store_status_history(store_id);

-- Add brand_id to store_master if not exists (to link stores to brands)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_master' AND column_name = 'brand_id') THEN
    ALTER TABLE public.store_master ADD COLUMN brand_id UUID REFERENCES public.brands(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_store_master_brand_id ON public.store_master(brand_id);
