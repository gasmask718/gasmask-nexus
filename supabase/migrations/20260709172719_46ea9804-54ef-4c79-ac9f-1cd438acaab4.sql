ALTER TABLE public.dd_ai_config ADD COLUMN IF NOT EXISTS remove_bg_api_key text;
UPDATE public.dd_ai_config SET remove_bg_api_key = 'RcwZpHpfjs4eavxxLrKGoLiK' WHERE id = 1;