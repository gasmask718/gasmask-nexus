
ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS key_features text[],
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS package_text text,
  ADD COLUMN IF NOT EXISTS flavor_or_variant text,
  ADD COLUMN IF NOT EXISTS size_or_count text,
  ADD COLUMN IF NOT EXISTS brand_visible text,
  ADD COLUMN IF NOT EXISTS recognition jsonb;
