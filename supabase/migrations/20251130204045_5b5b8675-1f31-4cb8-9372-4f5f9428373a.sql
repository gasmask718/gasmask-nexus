-- Enhanced Audit Logging System

-- Add indexes for better audit log performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Add indexes for audit_log table
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON public.audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_acted ON public.audit_log(acted_at DESC);

-- Create a view for easier audit querying (admin only via RLS)
CREATE OR REPLACE VIEW public.audit_summary AS
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
ORDER BY al.created_at DESC;

-- Function to log security events specifically
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    metadata
  ) VALUES (
    auth.uid(),
    p_action,
    'security',
    jsonb_build_object(
      'details', p_details,
      'timestamp', now(),
      'source', 'security_monitor'
    )
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;