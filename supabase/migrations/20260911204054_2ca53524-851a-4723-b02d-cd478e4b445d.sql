-- Angel Abdul's cousin: owner-confirmed contact only, no personal name provided.
INSERT INTO public.ambassadors (name, email, phone_primary, is_active, state, tags, tracking_code)
SELECT 'Angel Abdul Cousin', 'Edwin.jimenez188@outlook.com', '3473643425', true, 'NY',
       'NAME_CONFIRMATION_PENDING;READY_FOR_INVITE_AFTER_MAIL_FIX;OWNER_ASSIGNED_SEED_STORES;PHONE_SHARED_WITH_AMB_AMB-C8F8ED',
       'AMB-ANGCUZ'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ambassadors WHERE lower(email) = lower('Edwin.jimenez188@outlook.com')
);

-- Two owner-assigned seed stores: direct access only, no claim, no territory.
INSERT INTO public.ambassador_assignments (ambassador_id, store_id, active, assignment_type)
SELECT a.id, s.store_id, true, 'assigned'
FROM public.ambassadors a
CROSS JOIN (VALUES
  ('5f42f2eb-93e2-4581-9312-67b3a264ce64'::uuid),
  ('9b7621bb-56aa-4211-80f6-c9f833a56f4f'::uuid)
) AS s(store_id)
WHERE lower(a.email) = lower('Edwin.jimenez188@outlook.com')
  AND NOT EXISTS (
    SELECT 1 FROM public.ambassador_assignments aa
    WHERE aa.ambassador_id = a.id AND aa.store_id = s.store_id AND aa.active
  );