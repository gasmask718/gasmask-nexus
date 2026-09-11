-- 1. Unlink the incorrect AMIR record from Ching's auth user
UPDATE public.ambassadors
   SET previous_user_id = user_id,
       user_id = NULL,
       login_unlinked_at = now(),
       login_unlink_reason = 'Incorrect link to GasMask admin account (gasmaskapprovedllc@gmail.com); Ching field identity moved to his own ambassador record'
 WHERE id = 'a1343f37-7159-4f81-a7c5-6fab39e245f3'
   AND user_id = '6019a316-2d95-4662-997c-c47bd0b37697';

-- 2. Link Ching's own ambassador record to his existing admin auth user
UPDATE public.ambassadors
   SET user_id = '6019a316-2d95-4662-997c-c47bd0b37697',
       email = COALESCE(email, 'gasmaskapprovedllc@gmail.com'),
       is_active = true,
       updated_at = now()
 WHERE id = '903ecd8b-990f-456c-bdaf-18ef5f0b4317'
   AND user_id IS NULL;

-- 3. Ensure the ambassador system role is present alongside admin/owner (additive only)
INSERT INTO public.user_roles (user_id, role)
VALUES ('6019a316-2d95-4662-997c-c47bd0b37697', 'ambassador')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Harden capture assignment: only active, non-deleted ambassador identities
CREATE OR REPLACE FUNCTION public.assign_field_captured_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ambassador_id uuid;
  v_driver_id uuid;
  v_assigned boolean := false;
BEGIN
  IF NEW.captured_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.id INTO v_ambassador_id
  FROM ambassadors a
  WHERE a.user_id = NEW.captured_by_user_id
    AND a.deleted_at IS NULL
    AND a.is_active IS TRUE
  ORDER BY a.created_at
  LIMIT 1;

  IF v_ambassador_id IS NOT NULL THEN
    INSERT INTO ambassador_assignments (ambassador_id, store_id, active, created_by)
    SELECT v_ambassador_id, NEW.id, true, NEW.captured_by_user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM ambassador_assignments aa
      WHERE aa.store_id = NEW.id AND aa.ambassador_id = v_ambassador_id
        AND aa.active IS TRUE AND aa.unassigned_at IS NULL
    );
    v_assigned := true;
  ELSE
    SELECT d.id INTO v_driver_id
    FROM drivers d
    WHERE d.user_id = NEW.captured_by_user_id AND d.status = 'active'
    ORDER BY d.created_at
    LIMIT 1;

    IF v_driver_id IS NOT NULL THEN
      INSERT INTO driver_assignments (driver_id, store_id, is_active, created_by)
      SELECT v_driver_id, NEW.id, true, NEW.captured_by_user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM driver_assignments da
        WHERE da.store_id = NEW.id AND da.driver_id = v_driver_id AND da.is_active IS TRUE
      );
      v_assigned := true;
    END IF;
  END IF;

  UPDATE store_master
     SET field_assignment_status = CASE WHEN v_assigned THEN 'assigned' ELSE 'assignment_required' END
   WHERE id = NEW.id;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.assign_field_captured_store() FROM anon, authenticated;