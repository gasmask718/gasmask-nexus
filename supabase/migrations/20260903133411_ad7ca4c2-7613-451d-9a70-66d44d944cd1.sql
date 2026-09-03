INSERT INTO public.user_roles (user_id, role)
VALUES ('6019a316-2d95-4662-997c-c47bd0b37697', 'wholesaler')
ON CONFLICT (user_id, role) DO NOTHING;