CREATE TABLE IF NOT EXISTS public.customer_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  business_name TEXT,
  site_url TEXT NOT NULL,
  preview_url TEXT,
  repo_url TEXT,
  source_table TEXT,
  source_id UUID,
  source_brand TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_dev_email TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_site_id UUID REFERENCES public.customer_sites(id) ON DELETE CASCADE,
  source_table TEXT,
  source_id UUID,
  source_brand TEXT,
  customer_name TEXT,
  customer_email TEXT,
  form_type TEXT NOT NULL DEFAULT 'website_intake',
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_site_id UUID NOT NULL REFERENCES public.customer_sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  requested_by_email TEXT,
  assigned_dev_email TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_sites_source ON public.customer_sites(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_customer_sites_status ON public.customer_sites(status);
CREATE INDEX IF NOT EXISTS idx_customer_intake_site ON public.customer_intake_forms(customer_site_id);
CREATE INDEX IF NOT EXISTS idx_customer_intake_source ON public.customer_intake_forms(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_customer_cr_site ON public.customer_change_requests(customer_site_id);
CREATE INDEX IF NOT EXISTS idx_customer_cr_status ON public.customer_change_requests(status);

ALTER TABLE public.customer_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_change_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_developer_or_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND (
        u.email IN ('admin123@gmail.com','dev@gmail.com')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = u.id AND p.role::text IN ('admin','owner','developer','dev')
        )
      )
  );
$$;

CREATE POLICY "devs view customer sites" ON public.customer_sites FOR SELECT TO authenticated
  USING (public.is_developer_or_admin() OR created_by = auth.uid());
CREATE POLICY "devs insert customer sites" ON public.customer_sites FOR INSERT TO authenticated
  WITH CHECK (public.is_developer_or_admin());
CREATE POLICY "devs update customer sites" ON public.customer_sites FOR UPDATE TO authenticated
  USING (public.is_developer_or_admin());
CREATE POLICY "devs delete customer sites" ON public.customer_sites FOR DELETE TO authenticated
  USING (public.is_developer_or_admin());

CREATE POLICY "devs view intake" ON public.customer_intake_forms FOR SELECT TO authenticated
  USING (public.is_developer_or_admin());
CREATE POLICY "devs insert intake" ON public.customer_intake_forms FOR INSERT TO authenticated
  WITH CHECK (public.is_developer_or_admin());
CREATE POLICY "devs update intake" ON public.customer_intake_forms FOR UPDATE TO authenticated
  USING (public.is_developer_or_admin());
CREATE POLICY "devs delete intake" ON public.customer_intake_forms FOR DELETE TO authenticated
  USING (public.is_developer_or_admin());

CREATE POLICY "devs view change requests" ON public.customer_change_requests FOR SELECT TO authenticated
  USING (public.is_developer_or_admin());
CREATE POLICY "devs insert change requests" ON public.customer_change_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_developer_or_admin());
CREATE POLICY "devs update change requests" ON public.customer_change_requests FOR UPDATE TO authenticated
  USING (public.is_developer_or_admin());
CREATE POLICY "devs delete change requests" ON public.customer_change_requests FOR DELETE TO authenticated
  USING (public.is_developer_or_admin());

CREATE TRIGGER trg_customer_sites_updated
  BEFORE UPDATE ON public.customer_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_customer_cr_updated
  BEFORE UPDATE ON public.customer_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();