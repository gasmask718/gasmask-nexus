
ALTER TABLE public.brandaro_clients ADD COLUMN IF NOT EXISTS client_status TEXT DEFAULT 'active';
ALTER TABLE public.brandaro_clients ADD COLUMN IF NOT EXISTS package_chosen TEXT;
