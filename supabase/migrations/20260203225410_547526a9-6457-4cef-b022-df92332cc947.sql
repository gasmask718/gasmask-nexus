
-- =============================================================
-- PHASE 1: Add per-sticker date tracking and per-sticker notes
-- to the canonical store_brand_stickers table
-- =============================================================

-- Add per-sticker date tracking columns
ALTER TABLE public.store_brand_stickers
ADD COLUMN IF NOT EXISTS front_door_sticker_put_on_at timestamptz,
ADD COLUMN IF NOT EXISTS front_door_sticker_last_seen_at timestamptz,
ADD COLUMN IF NOT EXISTS front_door_sticker_notes text,
ADD COLUMN IF NOT EXISTS brand_character_sticker_put_on_at timestamptz,
ADD COLUMN IF NOT EXISTS brand_character_sticker_last_seen_at timestamptz,
ADD COLUMN IF NOT EXISTS brand_character_sticker_notes text,
ADD COLUMN IF NOT EXISTS authorized_retailer_sticker_put_on_at timestamptz,
ADD COLUMN IF NOT EXISTS authorized_retailer_sticker_last_seen_at timestamptz,
ADD COLUMN IF NOT EXISTS authorized_retailer_sticker_notes text,
ADD COLUMN IF NOT EXISTS telephone_number_sticker_put_on_at timestamptz,
ADD COLUMN IF NOT EXISTS telephone_number_sticker_last_seen_at timestamptz,
ADD COLUMN IF NOT EXISTS telephone_number_sticker_notes text;

-- Add role tracking for last update
ALTER TABLE public.store_brand_stickers
ADD COLUMN IF NOT EXISTS last_updated_by_role text;

-- Create function to auto-update put_on_at when sticker is installed
CREATE OR REPLACE FUNCTION public.update_sticker_put_on_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Front Door Sticker
  IF NEW.front_door_sticker = true AND (OLD.front_door_sticker IS NULL OR OLD.front_door_sticker = false) THEN
    NEW.front_door_sticker_put_on_at := now();
  END IF;
  
  -- Brand Character Sticker
  IF NEW.brand_character_sticker = true AND (OLD.brand_character_sticker IS NULL OR OLD.brand_character_sticker = false) THEN
    NEW.brand_character_sticker_put_on_at := now();
  END IF;
  
  -- Authorized Retailer Sticker
  IF NEW.authorized_retailer_sticker = true AND (OLD.authorized_retailer_sticker IS NULL OR OLD.authorized_retailer_sticker = false) THEN
    NEW.authorized_retailer_sticker_put_on_at := now();
  END IF;
  
  -- Telephone Number Sticker
  IF NEW.telephone_number_sticker = true AND (OLD.telephone_number_sticker IS NULL OR OLD.telephone_number_sticker = false) THEN
    NEW.telephone_number_sticker_put_on_at := now();
  END IF;
  
  -- Auto-update updated_at
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_update_sticker_put_on_dates ON public.store_brand_stickers;
CREATE TRIGGER trigger_update_sticker_put_on_dates
BEFORE UPDATE ON public.store_brand_stickers
FOR EACH ROW
EXECUTE FUNCTION public.update_sticker_put_on_dates();

-- Create index for querying stores with notes (for intelligence/compliance views)
CREATE INDEX IF NOT EXISTS idx_store_brand_stickers_notes 
ON public.store_brand_stickers (store_id) 
WHERE front_door_sticker_notes IS NOT NULL 
   OR brand_character_sticker_notes IS NOT NULL 
   OR authorized_retailer_sticker_notes IS NOT NULL 
   OR telephone_number_sticker_notes IS NOT NULL;

-- Create index for stale sticker queries (last_seen > X days)
CREATE INDEX IF NOT EXISTS idx_store_brand_stickers_last_seen 
ON public.store_brand_stickers (store_id, brand_name);

-- Add comment for documentation
COMMENT ON TABLE public.store_brand_stickers IS 'Canonical Brand Stickers & Compliance system. Per-brand tracking of 4 sticker types with install dates, verification dates, and per-sticker notes.';
