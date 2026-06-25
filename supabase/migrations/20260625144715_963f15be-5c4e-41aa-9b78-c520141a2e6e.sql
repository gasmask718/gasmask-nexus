
-- ============================================================
-- PHASE 7.1 — Storage: block anonymous LISTING of public buckets
-- ============================================================
-- The public CDN endpoint (/object/public/...) still serves files because
-- the bucket row is marked public; it bypasses RLS. RLS on storage.objects
-- only governs the LIST / signed-URL API. Restricting these SELECT policies
-- to the authenticated role kills anonymous list() enumeration while keeping
-- direct public-URL downloads working.

DO $$
DECLARE
  pol record;
  public_buckets text[] := ARRAY[
    'beauty-provider-media','call-audio','call-recordings','checklist-photos',
    'cold-call-audio','customer-documents','funding-documents','product-images',
    'profile-photos','storefront-captures','toptier-assets','va-lead-intake',
    'vendor-covers','vendor-photos','voicemail-templates'
  ];
BEGIN
  FOR pol IN
    SELECT policyname, qual
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND qual ~ ('bucket_id\s*=\s*''(' || array_to_string(public_buckets, '|') || ')''')
  LOOP
    -- Recreate the policy restricted to authenticated role.
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (%s)',
      pol.policyname, pol.qual
    );
  END LOOP;
END $$;

-- ============================================================
-- PHASE 7.2 — Materialized views: revoke anon API exposure
-- ============================================================
-- These analytical matviews are read by the signed-in operator UI only.
-- Revoke any default/inherited access from anon; grant explicit SELECT to
-- authenticated + service_role so the existing app keeps working.

REVOKE ALL ON public.store_intelligence_v FROM anon, public;
REVOKE ALL ON public.vendor_performance_summary FROM anon, public;

GRANT SELECT ON public.store_intelligence_v TO authenticated;
GRANT SELECT ON public.vendor_performance_summary TO authenticated;

GRANT ALL ON public.store_intelligence_v TO service_role;
GRANT ALL ON public.vendor_performance_summary TO service_role;
