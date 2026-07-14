
INSERT INTO public.roles (name, description) VALUES ('va', 'Virtual Assistant')
ON CONFLICT (name) DO NOTHING;

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'test-va@dynastyos.test' AND email_confirmed_at IS NULL;

INSERT INTO public.user_roles (user_id, role, role_name)
SELECT id, 'va'::app_role, 'va'
FROM auth.users
WHERE email = 'test-va@dynastyos.test'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_profiles (user_id, full_name, primary_role)
SELECT id, 'Test VA', 'va'
FROM auth.users
WHERE email = 'test-va@dynastyos.test'
ON CONFLICT (user_id) DO UPDATE SET primary_role = EXCLUDED.primary_role;
