
ALTER TABLE public.products_all
  ADD CONSTRAINT products_all_category_check
  CHECK (category IS NULL OR category IN (
    'disposable_vape','nicotine_pouch','tobacco_grabba','rolling_papers',
    'lighters','grinders','glass','vape_hardware','cbd_hemp','accessories'
  )) NOT VALID;
