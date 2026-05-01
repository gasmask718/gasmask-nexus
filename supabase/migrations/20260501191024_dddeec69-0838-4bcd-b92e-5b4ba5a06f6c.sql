DROP VIEW IF EXISTS public.v_va_directory;
CREATE VIEW public.v_va_directory AS
SELECT
  m.id AS membership_id,
  m.user_id,
  m.role,
  m.is_active,
  m.is_primary,
  m.created_at AS joined_at,
  c.id AS company_id,
  c.slug AS company_slug,
  c.name AS company_name,
  COALESCE(
    NULLIF(up.full_name, ''),
    NULLIF(p.name, ''),
    NULLIF(au.raw_user_meta_data->>'full_name', ''),
    NULLIF(au.raw_user_meta_data->>'name', ''),
    NULLIF(v.name, '')
  ) AS full_name,
  COALESCE(
    NULLIF(up.phone, ''),
    NULLIF(p.phone, ''),
    NULLIF(au.phone::text, ''),
    NULLIF(au.raw_user_meta_data->>'phone', ''),
    NULLIF(v.phone, '')
  ) AS phone,
  COALESCE(up.avatar_url, p.avatar_url) AS avatar_url,
  COALESCE(au.email::text, p.email, v.email) AS email
FROM va_company_memberships m
JOIN va_companies c ON c.id = m.company_id
LEFT JOIN user_profiles up ON up.user_id = m.user_id
LEFT JOIN profiles p ON p.id = m.user_id
LEFT JOIN vas v ON v.user_id = m.user_id
LEFT JOIN auth.users au ON au.id = m.user_id;