-- Clipper Nation public-read fix
-- Root cause: clipper_campaigns and dd_flash_sales had no anon SELECT policy
-- and no GRANT to anon/authenticated, so the public site (unauthenticated)
-- got empty results from the Data API.

-- clipper_campaigns: add anon SELECT for active campaigns, ensure grants
GRANT SELECT ON public.clipper_campaigns TO anon;
GRANT SELECT ON public.clipper_campaigns TO authenticated;

DROP POLICY IF EXISTS cc_public_read_active ON public.clipper_campaigns;
CREATE POLICY cc_public_read_active
  ON public.clipper_campaigns
  FOR SELECT
  TO anon
  USING (status = 'active');

-- dd_flash_sales: policy for public role already exists (active + within window)
-- but there was no GRANT, so Data API couldn't reach it. Add grants.
GRANT SELECT ON public.dd_flash_sales TO anon;
GRANT SELECT ON public.dd_flash_sales TO authenticated;