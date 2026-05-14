
CREATE TABLE IF NOT EXISTS public.va_ui_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text text NOT NULL,
  target_lang text NOT NULL,
  translated_text text NOT NULL,
  source_hash text GENERATED ALWAYS AS (md5(source_text)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_hash, target_lang)
);
CREATE INDEX IF NOT EXISTS idx_va_ui_translations_hash_lang ON public.va_ui_translations(source_hash, target_lang);
ALTER TABLE public.va_ui_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authenticated can read translations"
  ON public.va_ui_translations FOR SELECT TO authenticated USING (true);
