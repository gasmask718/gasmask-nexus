CREATE INDEX IF NOT EXISTS idx_sf_leads_ip_created ON public.surplus_funds_leads(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sf_attorneys_source_created ON public.surplus_funds_attorneys(application_source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sf_inquiries_ip_created ON public.surplus_funds_inquiries(ip_address, created_at DESC);