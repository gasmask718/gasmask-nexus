ALTER TABLE public.dd_ai_config ADD COLUMN IF NOT EXISTS re_intake_webhook_secret text;
UPDATE public.dd_ai_config
  SET re_intake_webhook_secret = 'Yg7#KzP9mR2!Xv8QhL5@Nc4FwT1$sJe6Ub3&Ap9MnR7'
  WHERE id = 1;