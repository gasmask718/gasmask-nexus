-- 1. Fix mutable search_path on project functions
ALTER FUNCTION public.dd_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.dd_target_b2b() SET search_path = public;
ALTER FUNCTION public.dd_target_d2c() SET search_path = public;
ALTER FUNCTION public.dd_margin_floor() SET search_path = public;
ALTER FUNCTION public.dd_margin_warn() SET search_path = public;
ALTER FUNCTION public.dd_margin_pct(integer, integer) SET search_path = public;
ALTER FUNCTION public.ut_upsert_partner_lead(jsonb) SET search_path = public;

-- 2. Remove materialized views from the Data API, expose via gated views
REVOKE ALL ON public.store_intelligence_v FROM anon, authenticated;
REVOKE ALL ON public.vendor_performance_summary FROM anon, authenticated;
REVOKE ALL ON public.store_invoice_activity FROM anon, authenticated;

CREATE OR REPLACE VIEW public.v_store_intelligence AS
  SELECT * FROM public.store_intelligence_v WHERE auth.uid() IS NOT NULL;
CREATE OR REPLACE VIEW public.v_vendor_performance_summary AS
  SELECT * FROM public.vendor_performance_summary WHERE auth.uid() IS NOT NULL;
CREATE OR REPLACE VIEW public.v_store_invoice_activity AS
  SELECT * FROM public.store_invoice_activity WHERE auth.uid() IS NOT NULL;

GRANT SELECT ON public.v_store_intelligence TO authenticated;
GRANT SELECT ON public.v_vendor_performance_summary TO authenticated;
GRANT SELECT ON public.v_store_invoice_activity TO authenticated;

-- 3. funding-documents: ownership-scoped access
DROP POLICY IF EXISTS "Anyone can view funding documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete funding documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload funding documents" ON storage.objects;

CREATE POLICY "funding_docs_owner_or_staff_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'funding-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.funding_clients fc
      WHERE fc.id::text = (storage.foldername(storage.objects.name))[1]
        AND (fc.user_id = auth.uid() OR fc.portal_user_id = auth.uid()::text OR fc.assigned_operator = auth.uid())
    )
  )
);

CREATE POLICY "funding_docs_owner_or_staff_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'funding-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.funding_clients fc
      WHERE fc.id::text = (storage.foldername(storage.objects.name))[1]
        AND (fc.user_id = auth.uid() OR fc.portal_user_id = auth.uid()::text OR fc.assigned_operator = auth.uid())
    )
  )
);

CREATE POLICY "funding_docs_owner_or_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'funding-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.funding_clients fc
      WHERE fc.id::text = (storage.foldername(storage.objects.name))[1]
        AND (fc.user_id = auth.uid() OR fc.portal_user_id = auth.uid()::text OR fc.assigned_operator = auth.uid())
    )
  )
);

-- 4. Public buckets: drop broad SELECT (listing) policies. Public URLs still work.
DROP POLICY IF EXISTS "Anyone can view checklist photos" ON storage.objects;
DROP POLICY IF EXISTS "Public intake reads" ON storage.objects;
DROP POLICY IF EXISTS "Public read va-lead-intake" ON storage.objects;
DROP POLICY IF EXISTS "Storefront captures are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "pp_pub_read" ON storage.objects;
DROP POLICY IF EXISTS "Public can read cold call audio" ON storage.objects;