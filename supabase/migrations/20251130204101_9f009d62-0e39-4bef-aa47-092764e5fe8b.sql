-- Fix: Drop the security definer view and recreate as regular view
DROP VIEW IF EXISTS public.audit_summary;

-- Recreate as a regular function instead (safer pattern)
CREATE OR REPLACE FUNCTION public.get_audit_summary(p_limit INT DEFAULT 100)
RETURNS TABLE (
  id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ,
  user_name TEXT,
  user_email TEXT,
  role_type public.app_role,
  metadata JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can access audit summary
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.created_at,
    p.name as user_name,
    p.email as user_email,
    al.role_type,
    al.metadata
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON al.user_id = p.id
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$;