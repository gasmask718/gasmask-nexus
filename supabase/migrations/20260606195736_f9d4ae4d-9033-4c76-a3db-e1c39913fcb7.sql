CREATE OR REPLACE VIEW public.v_va_directory
WITH (security_invoker = true) AS
WITH base AS (
  SELECT m.id::text AS membership_id, m.user_id, m.role, m.is_active, m.is_primary,
         m.created_at AS joined_at, c.id AS company_id, c.slug AS company_slug, c.name AS company_name
  FROM va_company_memberships m
  JOIN va_companies c ON c.id = m.company_id
  UNION ALL
  SELECT 'profile:'::text || u.user_id::text, u.user_id, 'va'::text, true, false,
         min(u.created_at), NULL::uuid, NULL::text, 'Unassigned'::text
  FROM (
    SELECT profiles.id AS user_id, profiles.created_at FROM profiles WHERE profiles.role::text = 'va'
    UNION
    SELECT user_profiles.user_id, user_profiles.created_at FROM user_profiles
    WHERE user_profiles.primary_role = 'va' OR ('va' = ANY (user_profiles.extra_roles))
  ) u
  WHERE NOT EXISTS (SELECT 1 FROM va_company_memberships m WHERE m.user_id = u.user_id)
  GROUP BY u.user_id
)
SELECT b.membership_id, b.user_id, b.role, b.is_active, b.is_primary, b.joined_at,
       b.company_id, b.company_slug, b.company_name,
       COALESCE(NULLIF(up.full_name,''), NULLIF(p.name,''), NULLIF(v.name,'')) AS full_name,
       COALESCE(NULLIF(up.phone,''), NULLIF(p.phone,''), NULLIF(v.phone,'')) AS phone,
       COALESCE(up.avatar_url, p.avatar_url) AS avatar_url,
       COALESCE(p.email, v.email) AS email
FROM base b
LEFT JOIN user_profiles up ON up.user_id = b.user_id
LEFT JOIN profiles p ON p.id = b.user_id
LEFT JOIN vas v ON v.user_id = b.user_id;

REVOKE ALL ON public.v_va_directory FROM anon;
GRANT SELECT ON public.v_va_directory TO authenticated, service_role;