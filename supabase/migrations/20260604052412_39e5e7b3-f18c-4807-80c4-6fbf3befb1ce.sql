ALTER TABLE public.products_all ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS products_all_category_idx ON public.products_all (category) WHERE category IS NOT NULL;