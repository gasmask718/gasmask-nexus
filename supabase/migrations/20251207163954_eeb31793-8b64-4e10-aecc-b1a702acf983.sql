
-- Add sticker fields to store_master if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_master' AND column_name = 'sticker_on_door') THEN
    ALTER TABLE public.store_master ADD COLUMN sticker_on_door BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_master' AND column_name = 'sticker_in_store') THEN
    ALTER TABLE public.store_master ADD COLUMN sticker_in_store BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_master' AND column_name = 'sticker_with_phone') THEN
    ALTER TABLE public.store_master ADD COLUMN sticker_with_phone BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_master' AND column_name = 'sticker_notes') THEN
    ALTER TABLE public.store_master ADD COLUMN sticker_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_master' AND column_name = 'borough_id') THEN
    ALTER TABLE public.store_master ADD COLUMN borough_id UUID REFERENCES public.boroughs(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_store_master_borough_id ON public.store_master(borough_id);
