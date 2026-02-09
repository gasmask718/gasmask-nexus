
-- Fix the audit trigger to compute row_hash, preventing NOT NULL violations
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_record_id uuid;
  v_old_data jsonb;
  v_new_data jsonb;
  v_row_hash text;
  v_prev_hash text;
BEGIN
  -- Get previous hash for chain integrity
  SELECT row_hash INTO v_prev_hash
  FROM public.audit_log
  ORDER BY created_at DESC
  LIMIT 1;

  IF (TG_OP = 'DELETE') THEN
    v_record_id := OLD.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_record_id := NEW.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'INSERT') THEN
    v_record_id := NEW.id;
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Compute deterministic SHA-256 row_hash
  v_row_hash := encode(
    extensions.digest(
      COALESCE(v_prev_hash, '') || TG_TABLE_NAME || COALESCE(v_record_id::text, '') || TG_OP || COALESCE(v_new_data::text, v_old_data::text, ''),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.audit_log(table_name, record_id, action, old_data, new_data, row_hash, prev_row_hash)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, v_old_data, v_new_data, v_row_hash, v_prev_hash);

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
