
-- VA Companies (employer brands the VA works for)
CREATE TABLE public.va_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  logo_url text,
  brand_color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.va_companies ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read company list (needed for portal header & invite acceptance)
CREATE POLICY "VA companies readable by authenticated" ON public.va_companies
  FOR SELECT TO authenticated USING (true);

-- Only admins can write
CREATE POLICY "Admins manage VA companies" ON public.va_companies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed the three companies
INSERT INTO public.va_companies (slug, name, brand_color) VALUES
  ('brandaro', 'Brandaro', '#06b6d4'),
  ('dynasty_connect', 'Dynasty Connect', '#a855f7'),
  ('brightsun_solar', 'BrightSun Solar', '#f59e0b');

-- Membership: which VA belongs to which company, with a role inside that company
CREATE TABLE public.va_company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.va_companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'va',
  is_primary boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, company_id)
);

CREATE INDEX idx_va_membership_user ON public.va_company_memberships(user_id);
CREATE INDEX idx_va_membership_company ON public.va_company_memberships(company_id);

ALTER TABLE public.va_company_memberships ENABLE ROW LEVEL SECURITY;

-- A VA can read their own memberships
CREATE POLICY "VA reads own memberships" ON public.va_company_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Admins can read & manage everything
CREATE POLICY "Admins read all memberships" ON public.va_company_memberships
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage memberships" ON public.va_company_memberships
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Invites
CREATE TABLE public.va_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.va_companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'va',
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | revoked | expired
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_va_invites_email ON public.va_invites(email);
CREATE INDEX idx_va_invites_token ON public.va_invites(token);
CREATE INDEX idx_va_invites_status ON public.va_invites(status);

ALTER TABLE public.va_invites ENABLE ROW LEVEL SECURITY;

-- Admins manage invites
CREATE POLICY "Admins manage VA invites" ON public.va_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: keep updated_at fresh
CREATE TRIGGER va_companies_set_updated_at
  BEFORE UPDATE ON public.va_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- View used by admin table to list VAs with company info
CREATE OR REPLACE VIEW public.v_va_directory
WITH (security_invoker = on) AS
SELECT
  m.id AS membership_id,
  m.user_id,
  m.role,
  m.is_active,
  m.is_primary,
  m.created_at AS joined_at,
  c.id AS company_id,
  c.slug AS company_slug,
  c.name AS company_name,
  up.full_name,
  up.phone,
  up.avatar_url,
  au.email
FROM public.va_company_memberships m
JOIN public.va_companies c ON c.id = m.company_id
LEFT JOIN public.user_profiles up ON up.user_id = m.user_id
LEFT JOIN auth.users au ON au.id = m.user_id;
