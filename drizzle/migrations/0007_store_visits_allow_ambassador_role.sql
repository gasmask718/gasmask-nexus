ALTER TABLE public.store_visits DROP CONSTRAINT IF EXISTS store_visits_role_type_check;
ALTER TABLE public.store_visits ADD CONSTRAINT store_visits_role_type_check
  CHECK (role_type = ANY (ARRAY['driver'::text, 'biker'::text, 'va'::text, 'admin'::text, 'ambassador'::text]));