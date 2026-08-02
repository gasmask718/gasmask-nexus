-- Lock down public catalog view: read-only for anon, read-only for authenticated.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.products_public FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.products_public FROM authenticated;

GRANT SELECT ON public.products_public TO anon;
GRANT SELECT ON public.products_public TO authenticated;
GRANT ALL ON public.products_public TO service_role;