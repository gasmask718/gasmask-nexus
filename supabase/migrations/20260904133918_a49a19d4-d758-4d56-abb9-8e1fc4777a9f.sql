INSERT INTO public.user_invitations (email, role, invite_token, invited_by, expires_at, invite_status, metadata)
SELECT 'efrelynblessedbeyondmeasure@gmail.com', 'va'::app_role, gen_random_uuid()::text,
       '6019a316-2d95-4662-997c-c47bd0b37697'::uuid, now() + interval '14 days', 'sent'::invite_status,
       jsonb_build_object(
         'provision_note', 'sales caller readiness 2026-09-04',
         'business_memberships', jsonb_build_array(
            jsonb_build_object('business_id','c3d4e5f6-a7b8-9012-cdef-123456789012','role','va'),
            jsonb_build_object('business_id','377370de-8a47-4d70-837d-c9f0d877fc91','role','va')
         ),
         'dialer_seat', jsonb_build_object('business_id','c3d4e5f6-a7b8-9012-cdef-123456789012','status','offline','max_concurrent_calls',1)
       )
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_invitations
  WHERE email = 'efrelynblessedbeyondmeasure@gmail.com' AND invite_status = 'sent'
);

INSERT INTO public.user_invitations (email, role, invite_token, invited_by, expires_at, invite_status, metadata)
SELECT 'francescelis01@gmail.com', 'va'::app_role, gen_random_uuid()::text,
       '6019a316-2d95-4662-997c-c47bd0b37697'::uuid, now() + interval '14 days', 'sent'::invite_status,
       jsonb_build_object(
         'provision_note', 'sales caller readiness 2026-09-04',
         'business_memberships', jsonb_build_array(
            jsonb_build_object('business_id','c3d4e5f6-a7b8-9012-cdef-123456789012','role','va')
         ),
         'dialer_seat', jsonb_build_object('business_id','c3d4e5f6-a7b8-9012-cdef-123456789012','status','offline','max_concurrent_calls',1)
       )
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_invitations
  WHERE email = 'francescelis01@gmail.com' AND invite_status = 'sent'
);