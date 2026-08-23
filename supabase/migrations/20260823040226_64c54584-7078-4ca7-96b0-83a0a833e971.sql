GRANT SELECT ON public.v_new_arrivals TO authenticated;
GRANT SELECT ON public.v_new_arrivals TO service_role;
GRANT SELECT ON public.v_new_arrivals_summary TO authenticated;
GRANT SELECT ON public.v_new_arrivals_summary TO service_role;

INSERT INTO public.public_view_contracts (view_name, allowed_privileges, public_roles, forbidden_columns, notes)
VALUES
  ('v_new_arrivals', ARRAY['SELECT']::text[], ARRAY['authenticated']::text[], ARRAY[]::text[], 'Owner/admin/employee/staff worklist; authenticated read only'),
  ('v_new_arrivals_summary', ARRAY['SELECT']::text[], ARRAY['authenticated']::text[], ARRAY[]::text[], 'Aggregate counts for the header strip')
ON CONFLICT (view_name) DO UPDATE SET notes = EXCLUDED.notes;