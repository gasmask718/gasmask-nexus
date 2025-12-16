-- Expand allowed product categories to match the Create Product form options
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE public.products
ADD CONSTRAINT products_category_check
CHECK (
  category IS NULL OR category = ANY (
    ARRAY[
      'grabba-leaf'::text,
      'tubes'::text,
      'bags'::text,
      'boxes'::text,
      'merch'::text,
      'accessories'::text,
      -- Backwards-compatible legacy values (keep to avoid breaking existing rows)
      'grabba'::text,
      'hot-mama'::text
    ]
  )
);