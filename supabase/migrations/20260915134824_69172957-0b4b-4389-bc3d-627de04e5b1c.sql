ALTER TABLE public.products_all DROP CONSTRAINT products_all_spec_source_check;
ALTER TABLE public.products_all ADD CONSTRAINT products_all_spec_source_check
  CHECK (spec_source IS NULL OR spec_source = ANY (ARRAY[
    'label_ocr','manual','estimate','import',
    'auto_web','auto_web_cache','admin_reviewed_web','manual_admin'
  ]));