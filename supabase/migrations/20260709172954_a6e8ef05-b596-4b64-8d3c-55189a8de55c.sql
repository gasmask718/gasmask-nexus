ALTER TABLE public.dd_ai_config ADD COLUMN IF NOT EXISTS easypost_api_key text;
ALTER TABLE public.dd_ai_config ADD COLUMN IF NOT EXISTS easypost_mode text DEFAULT 'test';
UPDATE public.dd_ai_config
  SET easypost_api_key = 'EZTKe1c09a214a3d44b6949d867bbbc931361MmZSa0GDAx7akGf6JXKDw',
      easypost_mode = 'test'
  WHERE id = 1;