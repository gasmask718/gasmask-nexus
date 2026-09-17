DO $$
DECLARE v_store uuid; v_amb uuid;
BEGIN
  SELECT id INTO v_amb FROM public.ambassadors WHERE tracking_code = 'QA-AMB-0917' AND deleted_at IS NULL LIMIT 1;
  IF v_amb IS NULL THEN RAISE EXCEPTION 'QA-AMB-0917 ambassador not found'; END IF;

  SELECT id INTO v_store FROM public.store_master
   WHERE store_name = 'QA NOTES TEST STORE — DO NOT USE' AND deleted_at IS NULL LIMIT 1;

  IF v_store IS NULL THEN
    INSERT INTO public.store_master (store_name, address, city, state, zip, is_simulation, status, health_status, do_not_call, notes, store_type)
    VALUES ('QA NOTES TEST STORE — DO NOT USE', '000 QA Test Address (non-production)', 'Queens', 'NY', '11419', false, 'inactive', 'healthy', true,
            'TEST/QA RECORD ONLY. Created 2026-09-17 for manual Ambassador Portal notes verification. Not a real customer. Exclude from reporting, outreach, routes, sales and commissions.', 'test')
    RETURNING id INTO v_store;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ambassador_assignments
     WHERE ambassador_id = v_amb AND store_id = v_store AND active IS TRUE AND unassigned_at IS NULL
  ) THEN
    INSERT INTO public.ambassador_assignments (ambassador_id, store_id, assignment_type, assignment_role, active, commission_rate, is_primary)
    VALUES (v_amb, v_store, 'assigned', 'assigned', true, 0, false);
  END IF;

  RAISE NOTICE 'store % assigned to ambassador %', v_store, v_amb;
END $$;