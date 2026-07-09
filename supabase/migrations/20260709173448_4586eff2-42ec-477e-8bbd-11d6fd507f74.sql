ALTER TABLE public.dd_ai_config ADD COLUMN IF NOT EXISTS cloudinary_cloud_name text;
ALTER TABLE public.dd_ai_config ADD COLUMN IF NOT EXISTS cloudinary_api_key text;
ALTER TABLE public.dd_ai_config ADD COLUMN IF NOT EXISTS cloudinary_api_secret text;
UPDATE public.dd_ai_config
  SET cloudinary_cloud_name = 'xfpnviow',
      cloudinary_api_key = '487153766994984',
      cloudinary_api_secret = 'guWPhbVNuS7y1hT8qufLpQQoPcE'
  WHERE id = 1;