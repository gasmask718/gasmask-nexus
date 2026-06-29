-- T4 cleanup: delete fixtures + deactivate dev-test developer role
DELETE FROM public.brandaro_build_jobs
  WHERE project_id IN (SELECT id FROM public.brandaro_projects WHERE project_name LIKE 'TEST-T4-%');
DELETE FROM public.brandaro_projects WHERE project_name LIKE 'TEST-T4-%';
DELETE FROM public.brandaro_clients WHERE business_name LIKE 'TEST-T4-%';

-- Deactivate dev-test by removing the developer role grant. Auth row preserved.
DELETE FROM public.user_roles
 WHERE user_id = 'fa77dbd8-54d2-43d7-b6a0-a280e2961722'::uuid
   AND role = 'developer';