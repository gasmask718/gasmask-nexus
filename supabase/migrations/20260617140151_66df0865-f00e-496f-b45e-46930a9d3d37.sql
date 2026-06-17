
-- Root cause: products_all has no Data API grants (only sandbox_exec). PostgREST
-- returns zero rows to anon/authenticated, so the Dynasty Direct catalog grid
-- is empty even though the RLS policy "Anyone can view active products" allows
-- status='active'. Grant the missing privileges + seed test fixtures.

GRANT SELECT ON public.products_all TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products_all TO authenticated;
GRANT ALL ON public.products_all TO service_role;

-- Seed: one ACTIVE catalog row (renders) + one INACTIVE/draft row (must stay hidden).
-- status='draft' violates the products_all_status_check constraint, so the
-- hidden fixture uses status='inactive' — equivalent for the RLS visibility
-- test (the "Anyone can view active products" policy only exposes status='active').
-- The dd_enforce_catalog_confirm_gate trigger is NOT bypassed: with no matching
-- dd_catalog_drafts row, the gate is a no-op and the row stays active.
INSERT INTO public.products_all (
  id, wholesaler_id, product_name, description, images,
  unit_type, inventory_qty, retail_price, store_price, wholesale_price,
  status, category
)
VALUES
  (
    '11111111-1111-1111-1111-000000000001',
    '75d65c04-d215-4c49-bd70-47c0e152feba',
    'B1 QA Active Fixture',
    'QA fixture — active product, must render on Dynasty Direct grid.',
    '["https://qalaaroashbggynpvqct.supabase.co/storage/v1/object/public/product-images/dd-catalog-onboard/1781103122040-icxs2j-0.jpg"]'::jsonb,
    'unit', 50, 29.99, 24.99, 14.99,
    'active', 'QA'
  ),
  (
    '11111111-1111-1111-1111-000000000002',
    '75d65c04-d215-4c49-bd70-47c0e152feba',
    'B1 QA Draft Fixture',
    'QA fixture — non-active product, must stay hidden from public grid.',
    '["https://qalaaroashbggynpvqct.supabase.co/storage/v1/object/public/product-images/dd-catalog-onboard/1781103122040-icxs2j-0.jpg"]'::jsonb,
    'unit', 10, 19.99, 15.99, 9.99,
    'inactive', 'QA'
  )
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  images = EXCLUDED.images,
  store_price = EXCLUDED.store_price,
  updated_at = now();
