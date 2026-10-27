ALTER TABLE public.change_lists DROP CONSTRAINT IF EXISTS change_lists_submitted_by_role_check;
ALTER TABLE public.change_lists ADD CONSTRAINT change_lists_submitted_by_role_check
  CHECK (submitted_by_role = ANY (ARRAY['driver'::text, 'biker'::text, 'va'::text, 'admin'::text, 'ambassador'::text]));