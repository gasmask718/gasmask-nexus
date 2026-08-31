CREATE TABLE IF NOT EXISTS public.va_call_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_slug text NOT NULL,
  step_number integer NOT NULL,
  step_name text NOT NULL,
  display_label text,
  va_says text NOT NULL,
  coaching_tip text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_slug, step_number)
);

CREATE TABLE IF NOT EXISTS public.va_call_rebuttals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_slug text NOT NULL,
  label text NOT NULL,
  human_response text,
  soft_rebuttal text,
  aggressive_rebuttal text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_slug, label)
);

GRANT SELECT ON public.va_call_scripts TO authenticated;
GRANT SELECT ON public.va_call_rebuttals TO authenticated;
GRANT ALL ON public.va_call_scripts TO service_role;
GRANT ALL ON public.va_call_rebuttals TO service_role;

ALTER TABLE public.va_call_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_call_rebuttals ENABLE ROW LEVEL SECURITY;

CREATE POLICY va_call_scripts_read ON public.va_call_scripts
  FOR SELECT TO authenticated USING (is_active OR public.is_elevated_user(auth.uid()));
CREATE POLICY va_call_scripts_manage ON public.va_call_scripts
  FOR ALL TO authenticated
  USING (public.is_elevated_user(auth.uid()))
  WITH CHECK (public.is_elevated_user(auth.uid()));

CREATE POLICY va_call_rebuttals_read ON public.va_call_rebuttals
  FOR SELECT TO authenticated USING (is_active OR public.is_elevated_user(auth.uid()));
CREATE POLICY va_call_rebuttals_manage ON public.va_call_rebuttals
  FOR ALL TO authenticated
  USING (public.is_elevated_user(auth.uid()))
  WITH CHECK (public.is_elevated_user(auth.uid()));

CREATE TRIGGER trg_va_call_scripts_updated BEFORE UPDATE ON public.va_call_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_va_call_rebuttals_updated BEFORE UPDATE ON public.va_call_rebuttals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();