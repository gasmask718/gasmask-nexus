REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.products_public FROM anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;
GRANT ALL ON public.products_public TO service_role;
DELETE FROM public.products_all WHERE product_name = 'DEPLOY_GUARD_PROBE';