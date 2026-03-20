-- Add permissive policies for service_role and broaden access
-- Service role needs full access for edge functions
CREATE POLICY "Service role full access insert"
ON public.brandaro_qualified_leads
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role full access select"
ON public.brandaro_qualified_leads
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Service role full access update"
ON public.brandaro_qualified_leads
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Also allow anon to read (for non-authenticated UI access)
CREATE POLICY "Anon can read leads"
ON public.brandaro_qualified_leads
FOR SELECT
TO anon
USING (true);