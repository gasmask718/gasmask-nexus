
CREATE TABLE IF NOT EXISTS public.brandaro_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order int NOT NULL DEFAULT 0,
  package_name text NOT NULL,
  price text NOT NULL,
  payment_terms text NOT NULL,
  included_highlights text NOT NULL,
  best_for text NOT NULL,
  is_target boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brandaro_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage packages" ON public.brandaro_packages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.brandaro_closing_techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order int NOT NULL DEFAULT 0,
  technique_name text NOT NULL,
  script text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brandaro_closing_techniques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage closing techniques" ON public.brandaro_closing_techniques
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.brandaro_industry_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order int NOT NULL DEFAULT 0,
  industry text NOT NULL,
  hook text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brandaro_industry_hooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage industry hooks" ON public.brandaro_industry_hooks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.brandaro_post_call_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order int NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  steps text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brandaro_post_call_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage post call workflows" ON public.brandaro_post_call_workflows
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
