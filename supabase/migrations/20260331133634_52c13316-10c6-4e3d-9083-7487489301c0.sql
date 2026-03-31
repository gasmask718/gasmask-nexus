
DROP POLICY IF EXISTS "Allow service role full access sbo_top_plays" ON public.sbo_top_plays;
DROP POLICY IF EXISTS "Allow authenticated read sbo_top_plays" ON public.sbo_top_plays;

CREATE POLICY "Allow service role full access sbo_top_plays"
ON public.sbo_top_plays FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read sbo_top_plays"
ON public.sbo_top_plays FOR SELECT TO authenticated
USING (true);

ALTER TABLE public.sbo_sms_recipients ADD COLUMN IF NOT EXISTS email TEXT;
