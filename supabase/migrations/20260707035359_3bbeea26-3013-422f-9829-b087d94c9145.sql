ALTER TABLE public.grant_applications ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.grant_opportunities ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.grant_tasks ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'general';