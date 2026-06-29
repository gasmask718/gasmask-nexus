-- SECTION 2: MOQ / case-pricing columns on products_all
ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS min_order_qty int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS case_qty int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS case_price_store numeric;

COMMENT ON COLUMN public.products_all.min_order_qty IS
  'Minimum order quantity for store tier. Enforced client-side on checkout. Default 1 = no minimum.';
COMMENT ON COLUMN public.products_all.case_qty IS
  'Units per case for case pricing. Used with case_price_store.';
COMMENT ON COLUMN public.products_all.case_price_store IS
  'Price per case for store-tier buyers. NULL = no case pricing available.';

-- SECTION 3: Permanent canonical comments
COMMENT ON TABLE public.suppliers IS
  'Procurement suppliers — internal purchasing, POs, vendor relationships. Columns: country, wechat, lead_time_days, reliability_score. Used by: OS Warehouse / Procurement pages only (src/pages/os/inventory/*, useProcurement.ts, SupplierFormModal). CANONICAL FOR: internal procurement. DO NOT merge with wholesalers table.';

COMMENT ON TABLE public.wholesalers IS
  'Dynasty Direct wholesale partners — product sourcing for DD storefront. ~41 rows. No user_id auth linkage (Phase 1 only — admin-managed). CANONICAL FOR: DD product sourcing. DO NOT merge with suppliers table. For auth-linked portal accounts see: wholesaler_profiles table.';

COMMENT ON TABLE public.wholesaler_profiles IS
  'Auth-linked wholesaler portal accounts (Phase 2 self-serve ready). 3 rows currently — remaining wholesalers from the wholesalers table need to be invited before Phase 2 self-serve can be enabled. Linked to: wholesalers.id via wholesaler_id FK.';

-- SECTION 4.2: Migration status view
CREATE OR REPLACE VIEW public.dd_wholesaler_migration_status AS
SELECT
  w.id,
  w.name,
  w.email AS contact_email,
  wp.id AS profile_id,
  wp.user_id,
  CASE WHEN wp.id IS NOT NULL
    THEN 'has_portal_account'
    ELSE 'needs_portal_account'
  END AS migration_status
FROM public.wholesalers w
LEFT JOIN public.wholesaler_profiles wp ON wp.wholesaler_id = w.id
WHERE w.deleted_at IS NULL
ORDER BY migration_status DESC, w.name;

GRANT SELECT ON public.dd_wholesaler_migration_status TO authenticated;
GRANT ALL ON public.dd_wholesaler_migration_status TO service_role;

-- SECTION 4.4: wholesaler_invites table
CREATE TABLE IF NOT EXISTS public.wholesaler_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'accepted', 'expired')),
  invited_by uuid,
  magic_link_url text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wholesaler_invites TO authenticated;
GRANT ALL ON public.wholesaler_invites TO service_role;

ALTER TABLE public.wholesaler_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage wholesaler invites" ON public.wholesaler_invites;
CREATE POLICY "Admin can manage wholesaler invites"
  ON public.wholesaler_invites
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS wholesaler_invites_wholesaler_idx
  ON public.wholesaler_invites(wholesaler_id);
CREATE INDEX IF NOT EXISTS wholesaler_invites_status_idx
  ON public.wholesaler_invites(status);