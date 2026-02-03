-- Add requested sticker columns to store_brand_stickers
-- These track store-requested stickers (independent of installed state)

ALTER TABLE public.store_brand_stickers
ADD COLUMN IF NOT EXISTS requested_front_door_sticker BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requested_brand_character_sticker BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requested_authorized_retailer_sticker BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requested_telephone_number_sticker BOOLEAN DEFAULT false;

-- Add comment documenting the requested columns
COMMENT ON COLUMN public.store_brand_stickers.requested_front_door_sticker IS 'Store has requested this sticker (independent of installed state)';
COMMENT ON COLUMN public.store_brand_stickers.requested_brand_character_sticker IS 'Store has requested this sticker (independent of installed state)';
COMMENT ON COLUMN public.store_brand_stickers.requested_authorized_retailer_sticker IS 'Store has requested this sticker (independent of installed state)';
COMMENT ON COLUMN public.store_brand_stickers.requested_telephone_number_sticker IS 'Store has requested this sticker (independent of installed state)';