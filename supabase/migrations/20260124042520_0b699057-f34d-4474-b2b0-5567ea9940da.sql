
-- Add hash chain fields for audit proof to ai_audit_logs and ai_call_decisions
ALTER TABLE public.ai_audit_logs
ADD COLUMN IF NOT EXISTS prev_hash TEXT,
ADD COLUMN IF NOT EXISTS row_hash TEXT,
ADD COLUMN IF NOT EXISTS decision_trace_id UUID DEFAULT gen_random_uuid();

ALTER TABLE public.ai_call_decisions
ADD COLUMN IF NOT EXISTS prev_hash TEXT,
ADD COLUMN IF NOT EXISTS row_hash TEXT,
ADD COLUMN IF NOT EXISTS decision_trace_id UUID DEFAULT gen_random_uuid();

ALTER TABLE public.ai_audit_events
ADD COLUMN IF NOT EXISTS prev_hash TEXT,
ADD COLUMN IF NOT EXISTS row_hash TEXT,
ADD COLUMN IF NOT EXISTS decision_trace_id UUID DEFAULT gen_random_uuid();

-- Create function to compute row hash for audit chain
CREATE OR REPLACE FUNCTION public.compute_audit_row_hash()
RETURNS TRIGGER AS $$
DECLARE
  prev_record RECORD;
  canonical_json TEXT;
BEGIN
  -- Get the previous row's hash for chain linkage
  IF TG_TABLE_NAME = 'ai_audit_logs' THEN
    SELECT row_hash INTO prev_record FROM public.ai_audit_logs 
    WHERE created_at < NEW.created_at 
    ORDER BY created_at DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'ai_call_decisions' THEN
    SELECT row_hash INTO prev_record FROM public.ai_call_decisions 
    WHERE created_at < NEW.created_at 
    ORDER BY created_at DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'ai_audit_events' THEN
    SELECT row_hash INTO prev_record FROM public.ai_audit_events 
    WHERE created_at < NEW.created_at 
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  NEW.prev_hash := COALESCE(prev_record.row_hash, 'GENESIS');
  
  -- Create canonical JSON of the row for hashing (excluding hash fields)
  canonical_json := jsonb_build_object(
    'id', NEW.id,
    'session_id', NEW.session_id,
    'business_id', NEW.business_id,
    'created_at', NEW.created_at,
    'decision_trace_id', NEW.decision_trace_id
  )::TEXT;
  
  -- Compute SHA256 hash
  NEW.row_hash := encode(sha256((NEW.prev_hash || canonical_json)::bytea), 'hex');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for hash computation
DROP TRIGGER IF EXISTS compute_audit_logs_hash ON public.ai_audit_logs;
CREATE TRIGGER compute_audit_logs_hash
  BEFORE INSERT ON public.ai_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_audit_row_hash();

DROP TRIGGER IF EXISTS compute_decisions_hash ON public.ai_call_decisions;
CREATE TRIGGER compute_decisions_hash
  BEFORE INSERT ON public.ai_call_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_audit_row_hash();

DROP TRIGGER IF EXISTS compute_audit_events_hash ON public.ai_audit_events;
CREATE TRIGGER compute_audit_events_hash
  BEFORE INSERT ON public.ai_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_audit_row_hash();

-- Ensure service role can always insert (fix potential RLS issues)
DROP POLICY IF EXISTS "Service can insert ai_audit_logs" ON public.ai_audit_logs;
CREATE POLICY "Service can insert ai_audit_logs" 
ON public.ai_audit_logs FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can insert ai_call_decisions" ON public.ai_call_decisions;
CREATE POLICY "Service can insert ai_call_decisions" 
ON public.ai_call_decisions FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can insert ai_audit_events" ON public.ai_audit_events;
CREATE POLICY "Service can insert ai_audit_events" 
ON public.ai_audit_events FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can insert ai_risk_events" ON public.ai_risk_events;
CREATE POLICY "Service can insert ai_risk_events" 
ON public.ai_risk_events FOR INSERT
WITH CHECK (true);
