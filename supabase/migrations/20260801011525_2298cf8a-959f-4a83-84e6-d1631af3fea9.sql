DROP POLICY IF EXISTS "sbo_sports read all" ON public.sbo_sports;

ALTER TABLE public.sbo_sports ENABLE ROW LEVEL SECURITY;

CREATE POLICY operator_select_sbo_sports ON public.sbo_sports
  FOR SELECT TO authenticated USING (public.is_sbo_operator());

REVOKE ALL ON public.sbo_sports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sbo_sports TO authenticated;
GRANT ALL ON public.sbo_sports TO service_role;