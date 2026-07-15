ALTER TABLE public.dd_ai_config ADD COLUMN IF NOT EXISTS serpapi_key text;
UPDATE public.dd_ai_config SET serpapi_key = 'd618586d7a5a1fb498f88a30c33edcbc0400e726f8c22386ec2c04210f9a8b90' WHERE id = 1;
INSERT INTO public.dd_ai_config (id, anthropic_api_key, serpapi_key)
SELECT 1, '', 'd618586d7a5a1fb498f88a30c33edcbc0400e726f8c22386ec2c04210f9a8b90'
WHERE NOT EXISTS (SELECT 1 FROM public.dd_ai_config WHERE id = 1);