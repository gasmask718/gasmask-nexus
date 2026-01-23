-- Fix audit trigger: record_id is UUID but was being cast to text
-- The COALESCE expression needs to cast to UUID, not text

CREATE OR REPLACE FUNCTION public.trg_audit_generic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_old_data jsonb;
  v_new_data jsonb;
  v_changed_fields text[];
  v_prev_hash text;
  v_payload jsonb;
  v_row_hash text;
  v_actor_user_id uuid;
  v_actor_role text;
  v_record_id uuid;
BEGIN
  -- Get actor info from session if available
  BEGIN
    v_actor_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_user_id := NULL;
  END;
  
  v_actor_role := current_setting('request.jwt.claims', true)::jsonb->>'role';

  -- Build old/new data
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSE -- UPDATE
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    -- Compute changed fields
    SELECT array_agg(key) INTO v_changed_fields
    FROM jsonb_each(v_new_data) n
    LEFT JOIN jsonb_each(v_old_data) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value;
  END IF;

  -- Extract record_id safely as UUID
  BEGIN
    v_record_id := COALESCE(
      (v_new_data->>'id')::uuid,
      (v_old_data->>'id')::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    -- If id is not a valid UUID, set to NULL
    v_record_id := NULL;
  END;

  -- Build payload for hashing
  v_payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'action', TG_OP,
    'old', v_old_data,
    'new', v_new_data,
    'ts', now()
  );

  -- Get previous hash for chain
  SELECT row_hash INTO v_prev_hash 
  FROM public.audit_log 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- Compute row hash using audit_compute_hash function
  v_row_hash := public.audit_compute_hash(v_prev_hash, v_payload);

  -- Insert audit record with computed hash
  INSERT INTO public.audit_log (
    table_name,
    record_id,
    action,
    before,
    after,
    changed_fields,
    actor_user_id,
    actor_role,
    source,
    prev_row_hash,
    row_hash
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_old_data,
    v_new_data,
    v_changed_fields,
    v_actor_user_id,
    v_actor_role,
    'trigger',
    v_prev_hash,
    v_row_hash
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;