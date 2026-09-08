REVOKE SELECT ON public.products_all_public FROM anon;
REVOKE SELECT ON public.v_products_all_with_stock FROM anon;
REVOKE SELECT ON public.dd_wholesaler_products_safe FROM anon;

INSERT INTO public.public_view_contracts (view_name, public_roles, allowed_privileges, forbidden_columns, notes)
VALUES
 ('products_all_public', ARRAY['authenticated'], ARRAY['SELECT'], ARRAY['wholesale_price','store_price','store_price_a','street_price','supplier_cost','supplier_cost_cents','map_price','case_price_store'], 'anon SELECT revoked 2026-09-08: internal pricing view, not storefront-safe. Use products_public for anon.'),
 ('v_products_all_with_stock', ARRAY['authenticated'], ARRAY['SELECT'], ARRAY['wholesale_price','store_price','street_price'], 'anon SELECT revoked 2026-09-08: admin ops view.'),
 ('dd_wholesaler_products_safe', ARRAY['authenticated'], ARRAY['SELECT'], ARRAY['supplier_cost','supplier_cost_cents'], 'anon SELECT revoked 2026-09-08: wholesaler portal view, supplier cost.')
ON CONFLICT (view_name) DO UPDATE
  SET public_roles = EXCLUDED.public_roles,
      allowed_privileges = EXCLUDED.allowed_privileges,
      forbidden_columns = EXCLUDED.forbidden_columns,
      notes = EXCLUDED.notes;