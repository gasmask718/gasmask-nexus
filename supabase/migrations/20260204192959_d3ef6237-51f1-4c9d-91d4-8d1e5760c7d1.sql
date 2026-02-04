-- Add governance columns to field_submissions
ALTER TABLE public.field_submissions 
ADD COLUMN IF NOT EXISTS changed_fields text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS risk_reasons text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS submission_source text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rollback_of_id uuid REFERENCES public.field_submissions(id) DEFAULT NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_field_submissions_created_at ON public.field_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_submissions_status_risk ON public.field_submissions(submission_status, risk_score);

-- Create a function to compute changed fields from payloads
CREATE OR REPLACE FUNCTION public.compute_changed_fields(before jsonb, after jsonb)
RETURNS text[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result text[] := '{}';
  key text;
BEGIN
  IF before IS NULL THEN
    -- All fields in after are "changed" (created)
    FOR key IN SELECT jsonb_object_keys(after)
    LOOP
      result := array_append(result, key);
    END LOOP;
  ELSE
    -- Compare before and after
    FOR key IN SELECT DISTINCT k FROM (
      SELECT jsonb_object_keys(before) AS k
      UNION
      SELECT jsonb_object_keys(after) AS k
    ) keys
    LOOP
      IF (before->key) IS DISTINCT FROM (after->key) THEN
        result := array_append(result, key);
      END IF;
    END LOOP;
  END IF;
  RETURN result;
END;
$$;

-- Create a function to compute risk reasons
CREATE OR REPLACE FUNCTION public.compute_risk_reasons(
  p_store_id uuid,
  p_entity_type field_entity_type,
  p_action_type field_action_type,
  p_submitted_by uuid,
  p_changed_fields text[]
)
RETURNS text[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  reasons text[] := '{}';
  recent_count integer;
BEGIN
  -- Check for multiple submissions in 24h
  SELECT COUNT(*) INTO recent_count
  FROM public.field_submissions
  WHERE store_id = p_store_id
    AND submitted_by_user_id = p_submitted_by
    AND created_at > NOW() - INTERVAL '24 hours';
  
  IF recent_count >= 3 THEN
    reasons := array_append(reasons, 'Multiple updates to same store in <24h');
  END IF;
  
  -- Check for deletion
  IF p_action_type = 'delete' THEN
    reasons := array_append(reasons, 'Deletion action requested');
  END IF;
  
  -- Check for sticker removal
  IF p_entity_type = 'brand_sticker' AND 'false' = ANY(
    SELECT jsonb_typeof(value) FROM jsonb_each(p_changed_fields::jsonb) WHERE value::text = 'false'
  ) THEN
    reasons := array_append(reasons, 'Sticker may have been removed');
  END IF;
  
  RETURN reasons;
END;
$$;

-- Trigger to auto-compute changed_fields and risk on insert
CREATE OR REPLACE FUNCTION public.field_submission_enrich()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Compute changed fields
  NEW.changed_fields := public.compute_changed_fields(NEW.payload_before, NEW.payload_after);
  
  -- Compute risk score based on factors
  NEW.risk_score := 0;
  
  -- High risk for deletions
  IF NEW.action_type = 'delete' THEN
    NEW.risk_score := NEW.risk_score + 40;
  END IF;
  
  -- Risk for many changes at once
  IF array_length(NEW.changed_fields, 1) > 5 THEN
    NEW.risk_score := NEW.risk_score + 20;
  END IF;
  
  -- Additional risk reasons based on patterns
  DECLARE
    recent_count integer;
  BEGIN
    SELECT COUNT(*) INTO recent_count
    FROM public.field_submissions
    WHERE store_id = NEW.store_id
      AND submitted_by_user_id = NEW.submitted_by_user_id
      AND created_at > NOW() - INTERVAL '24 hours';
    
    IF recent_count >= 3 THEN
      NEW.risk_score := NEW.risk_score + 30;
      NEW.risk_reasons := array_append(NEW.risk_reasons, 'Multiple updates to same store in <24h');
    END IF;
  END;
  
  -- Add deletion reason
  IF NEW.action_type = 'delete' THEN
    NEW.risk_reasons := array_append(NEW.risk_reasons, 'Deletion action requested');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_field_submission_enrich ON public.field_submissions;
CREATE TRIGGER trg_field_submission_enrich
  BEFORE INSERT ON public.field_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.field_submission_enrich();