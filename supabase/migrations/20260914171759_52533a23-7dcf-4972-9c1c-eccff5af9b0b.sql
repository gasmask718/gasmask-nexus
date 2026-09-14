-- 1) Reuse store_review_events for the daily "handled" marker
ALTER TABLE public.store_review_events DROP CONSTRAINT IF EXISTS store_review_events_review_type_check;
ALTER TABLE public.store_review_events
  ADD CONSTRAINT store_review_events_review_type_check
  CHECK (review_type = ANY (ARRAY['admin'::text,'va'::text,'handled'::text]));

ALTER TABLE public.store_review_events ADD COLUMN IF NOT EXISTS handled_on date;

CREATE OR REPLACE FUNCTION public.stamp_store_review_handled_on()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.review_type = 'handled' THEN
    NEW.handled_on := (timezone('America/New_York', COALESCE(NEW.reviewed_at, now())))::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_store_review_handled_on ON public.store_review_events;
CREATE TRIGGER trg_stamp_store_review_handled_on
BEFORE INSERT OR UPDATE ON public.store_review_events
FOR EACH ROW EXECUTE FUNCTION public.stamp_store_review_handled_on();

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_review_handled_per_day
  ON public.store_review_events (store_id, reviewed_by, handled_on)
  WHERE review_type = 'handled';

DROP POLICY IF EXISTS "review_events insert (role-gated)" ON public.store_review_events;
CREATE POLICY "review_events insert (role-gated)" ON public.store_review_events
  FOR INSERT TO authenticated
  WITH CHECK (
    review_type = 'va'
    OR review_type = 'handled'
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
  );

CREATE OR REPLACE FUNCTION public.mark_store_handled_today(_store_id uuid, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (timezone('America/New_York', now()))::date;
  v_id uuid;
  v_created boolean := false;
  v_at timestamptz;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF _store_id IS NULL THEN RAISE EXCEPTION 'store id required'; END IF;

  SELECT id, reviewed_at INTO v_id, v_at
    FROM store_review_events
   WHERE store_id = _store_id AND reviewed_by = v_user
     AND review_type = 'handled' AND handled_on = v_today
   LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO store_review_events (store_id, review_type, action, reviewed_by, note)
    VALUES (_store_id, 'handled', 'reviewed', v_user, _note)
    ON CONFLICT (store_id, reviewed_by, handled_on) WHERE review_type = 'handled' DO NOTHING
    RETURNING id, reviewed_at INTO v_id, v_at;
    v_created := v_id IS NOT NULL;

    IF v_id IS NULL THEN
      SELECT id, reviewed_at INTO v_id, v_at
        FROM store_review_events
       WHERE store_id = _store_id AND reviewed_by = v_user
         AND review_type = 'handled' AND handled_on = v_today
       LIMIT 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'event_id', v_id,
    'created', v_created,
    'handled_on', v_today,
    'handled_at', v_at,
    'handled_by', v_user
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_store_handled_today(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_store_handled_today(uuid, text) TO authenticated;

-- 2) Canonical primary-contact update (no duplicate contacts)
CREATE OR REPLACE FUNCTION public.set_store_primary_contact(_store_id uuid, _name text, _phone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text := nullif(btrim(_name), '');
  v_phone text := nullif(btrim(_phone), '');
  v_contact_id uuid;
  v_action text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'contact name is required'; END IF;
  IF NOT (is_elevated_user(v_user) OR is_internal_staff(v_user) OR va_can_access_store(_store_id)) THEN
    RAISE EXCEPTION 'not authorized for this store';
  END IF;

  -- existing primary row -> rename in place (never duplicate)
  SELECT id INTO v_contact_id
    FROM store_contacts
   WHERE store_id = _store_id AND is_primary = true AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    UPDATE store_contacts
       SET name = v_name,
           phone = COALESCE(v_phone, phone),
           updated_by = v_user
     WHERE id = v_contact_id;
    v_action := 'renamed_primary';
  ELSE
    -- same person already on file -> promote, don't duplicate
    SELECT id INTO v_contact_id
      FROM store_contacts
     WHERE store_id = _store_id AND deleted_at IS NULL
       AND lower(btrim(name)) = lower(v_name)
     ORDER BY created_at LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      UPDATE store_contacts
         SET is_primary = true,
             phone = COALESCE(v_phone, phone),
             updated_by = v_user
       WHERE id = v_contact_id;
      v_action := 'promoted_existing';
    ELSE
      INSERT INTO store_contacts (store_id, name, phone, is_primary, role, source, updated_by)
      VALUES (_store_id, v_name, v_phone, true, 'primary', 'store_profile', v_user)
      RETURNING id INTO v_contact_id;
      v_action := 'created_primary';
    END IF;
  END IF;

  UPDATE store_master SET contact_name = v_name WHERE id = _store_id;
  UPDATE stores SET primary_contact_name = v_name WHERE id = _store_id;

  RETURN jsonb_build_object('contact_id', v_contact_id, 'action', v_action, 'name', v_name);
END;
$$;

REVOKE ALL ON FUNCTION public.set_store_primary_contact(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_store_primary_contact(uuid, text, text) TO authenticated;