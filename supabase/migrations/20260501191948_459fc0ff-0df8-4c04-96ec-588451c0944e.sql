DROP VIEW IF EXISTS public.v_va_directory;
CREATE VIEW public.v_va_directory AS
WITH base AS (
  -- VAs with a company membership
  SELECT
    m.id::text AS membership_id,
    m.user_id,
    m.role::text AS role,
    m.is_active,
    m.is_primary,
    m.created_at AS joined_at,
    c.id AS company_id,
    c.slug AS company_slug,
    c.name AS company_name
  FROM va_company_memberships m
  JOIN va_companies c ON c.id = m.company_id

  UNION ALL

  -- VAs identified by profile role, with no membership
  SELECT
    ('profile:' || u.user_id::text) AS membership_id,
    u.user_id,
    'va'::text AS role,
    true AS is_active,
    false AS is_primary,
    u.created_at AS joined_at,
    NULL::uuid AS company_id,
    NULL::text AS company_slug,
    'Unassigned'::text AS company_name
  FROM (
    SELECT id AS user_id, created_at FROM profiles WHERE role::text = 'va'
    UNION
    SELECT user_id, created_at FROM user_profiles WHERE primary_role = 'va' OR 'va' = ANY(extra_roles)
  ) u
  WHERE NOT EXISTS (
    SELECT 1 FROM va_company_memberships m WHERE m.user_id = u.user_id
  )
)
SELECT
  b.membership_id,
  b.user_id,
  b.role,
  b.is_active,
  b.is_primary,
  b.joined_at,
  b.company_id,
  b.company_slug,
  b.company_name,
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
FROM base b
LEFT JOIN user_profiles up ON up.user_id = b.user_id
LEFT JOIN profiles p ON p.id = b.user_id
LEFT JOIN vas v ON v.user_id = b.user_id
LEFT JOIN auth.users au ON au.id = b.user_id;