DELETE FROM public.user_roles
WHERE user_id = '8d25323c-c592-4d5d-bd2d-3849eac68a55'
  AND role = 'pending';

INSERT INTO public.user_profiles (user_id, full_name, phone, primary_role)
SELECT '8d25323c-c592-4d5d-bd2d-3849eac68a55'::uuid,
       COALESCE(NULLIF(a.name, ''), 'Rufino Vinales'),
       COALESCE(NULLIF(a.phone_primary, ''), NULLIF(a.personal_phone, ''), '646-528-7484'),
       'ambassador'
FROM public.ambassadors a
WHERE a.id = 'bec6d140-ec1b-4dc0-890c-6dc22f7a2f71'
ON CONFLICT (user_id) DO NOTHING;