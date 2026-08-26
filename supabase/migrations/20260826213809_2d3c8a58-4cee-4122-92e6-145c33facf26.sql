ALTER TABLE public.dd_catalog_drafts
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS no_printed_label boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'camera';

-- ── Column secrecy: suppliers must never read retail pricing / margin research.
-- RLS cannot hide columns, so remove table-level SELECT and expose curated views.
REVOKE SELECT ON public.dd_catalog_drafts FROM authenticated;
REVOKE SELECT ON public.dd_catalog_drafts FROM anon;
GRANT SELECT (id) ON public.dd_catalog_drafts TO authenticated; -- insert ... returning id
GRANT INSERT, UPDATE, DELETE ON public.dd_catalog_drafts TO authenticated;
GRANT ALL ON public.dd_catalog_drafts TO service_role;

CREATE OR REPLACE VIEW public.dd_wholesaler_drafts_safe AS
SELECT d.id, d.created_at, d.updated_at, d.created_by, d.supplier_id,
       d.product_name, d.category, d.status, d.sku, d.inventory_qty,
       d.cost, d.weight_oz, d.dimensions, d.no_printed_label, d.source,
       d.input_photos, d.enhanced, d.selected, d.image_variants, d.label_photo_url,
       d.copy, d.recognition, d.label_extraction,
       d.notes, d.rejection_reason, d.submitted_at,
       d.measurements_verified_at, d.confirmed_at, d.published_product_id
FROM public.dd_catalog_drafts d
WHERE d.created_by = auth.uid()
   OR d.supplier_id IN (SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid());

CREATE OR REPLACE VIEW public.dd_admin_catalog_drafts AS
SELECT d.*
FROM public.dd_catalog_drafts d
WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
   OR public.has_role(auth.uid(), 'owner'::public.app_role);

GRANT SELECT ON public.dd_wholesaler_drafts_safe TO authenticated;
GRANT SELECT ON public.dd_admin_catalog_drafts TO authenticated;

-- ── Pick slip: item names, quantities and the box ddBoxing already selected.
CREATE OR REPLACE VIEW public.v_wholesaler_pick_slip AS
SELECT f.id AS fulfillment_id,
       f.order_id,
       f.wholesaler_id,
       f.status,
       s.box_name,
       s.box_count,
       s.billable_weight_oz,
       s.length_in, s.width_in, s.height_in,
       COALESCE(li.items, '[]'::jsonb) AS pick_items
FROM public.marketplace_fulfillments f
LEFT JOIN LATERAL (
  SELECT sh.box_name, sh.box_count, sh.billable_weight_oz, sh.length_in, sh.width_in, sh.height_in
  FROM public.dd_shipments sh
  WHERE sh.order_id = f.order_id
    AND (sh.wholesaler_id = f.wholesaler_id OR sh.wholesaler_id IS NULL)
  ORDER BY sh.created_at DESC
  LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
           'product_id', el->>'product_id',
           'qty', COALESCE((el->>'qty')::numeric, (el->>'quantity')::numeric, 1),
           'name', COALESCE(el->>'product_name', el->>'name', p.product_name, 'Unknown item'),
           'sku', el->>'sku'
         ) ORDER BY COALESCE(el->>'product_name', el->>'name', p.product_name)) AS items
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(f.items_snapshot) = 'array' THEN f.items_snapshot ELSE '[]'::jsonb END) el
  LEFT JOIN public.products_all p
    ON (el->>'product_id') ~ '^[0-9a-f-]{36}$' AND p.id = (el->>'product_id')::uuid
) li ON true
WHERE f.wholesaler_id IN (SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid())
   OR public.has_role(auth.uid(), 'admin'::public.app_role)
   OR public.has_role(auth.uid(), 'owner'::public.app_role);

GRANT SELECT ON public.v_wholesaler_pick_slip TO authenticated;

INSERT INTO public.public_view_contracts (view_name, allowed_privileges, public_roles, forbidden_columns, notes)
VALUES
  ('dd_wholesaler_drafts_safe', ARRAY['SELECT'], ARRAY['authenticated'], ARRAY['pricing','price_research','market_check'], 'Supplier-safe catalog drafts. Never expose retail/store pricing or margin research.'),
  ('dd_admin_catalog_drafts', ARRAY['SELECT'], ARRAY['authenticated'], ARRAY[]::text[], 'Admin/owner-gated full draft rows for the review queue.'),
  ('v_wholesaler_pick_slip', ARRAY['SELECT'], ARRAY['authenticated'], ARRAY[]::text[], 'Pick slip: item names, quantities and the selected shipping box.')
ON CONFLICT (view_name) DO UPDATE
  SET allowed_privileges = EXCLUDED.allowed_privileges,
      public_roles = EXCLUDED.public_roles,
      forbidden_columns = EXCLUDED.forbidden_columns,
      notes = EXCLUDED.notes;