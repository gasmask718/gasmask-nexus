
-- 1. Assignment status marker on the canonical store list
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS field_assignment_status text;

COMMENT ON COLUMN public.store_master.field_assignment_status IS
  'For field-captured stores: assigned | assignment_required. NULL for non-field-origin rows.';

-- 2. Field-preserving capture -> canonical store sync (same id, same architecture)
CREATE OR REPLACE FUNCTION public.sync_store_to_store_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapped_type text;
BEGIN
  mapped_type := CASE LOWER(COALESCE(NEW.type::text, 'other'))
    WHEN 'bodega' THEN 'bodega'
    WHEN 'smoke_shop' THEN 'smoke_shop'
    WHEN 'smoke shop' THEN 'smoke_shop'
    WHEN 'tobacco shop' THEN 'smoke_shop'
    WHEN 'gas_station' THEN 'gas_station'
    WHEN 'gas station' THEN 'gas_station'
    WHEN 'wholesaler' THEN 'wholesaler'
    WHEN 'convenience store' THEN 'bodega'
    WHEN 'retail' THEN 'other'
    ELSE 'other'
  END;

  INSERT INTO store_master (
    id, store_name, address, city, state, zip, is_simulation,
    phone, contact_name, owner_name, notes, storefront_photo_url,
    store_type, business_id
  )
  VALUES (
    NEW.id,
    NEW.name,
    COALESCE(NEW.address_street, ''),
    COALESCE(NEW.address_city, ''),
    COALESCE(NEW.address_state, ''),
    COALESCE(NEW.address_zip, ''),
    COALESCE(NEW.is_simulation, false),
    NULLIF(btrim(COALESCE(NEW.phone, '')), ''),
    NULLIF(btrim(COALESCE(NEW.primary_contact_name, '')), ''),
    NULLIF(btrim(COALESCE(NEW.primary_contact_name, '')), ''),
    NULLIF(btrim(COALESCE(NEW.notes, '')), ''),
    NEW.storefront_photo_url,
    mapped_type,
    'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid   -- GasMask
  )
  ON CONFLICT (id) DO UPDATE SET
    store_name    = EXCLUDED.store_name,
    address       = EXCLUDED.address,
    city          = EXCLUDED.city,
    state         = EXCLUDED.state,
    zip           = EXCLUDED.zip,
    is_simulation = EXCLUDED.is_simulation,
    -- never overwrite curated values; only fill what is missing
    phone                = COALESCE(store_master.phone, EXCLUDED.phone),
    contact_name         = COALESCE(store_master.contact_name, EXCLUDED.contact_name),
    owner_name           = COALESCE(store_master.owner_name, EXCLUDED.owner_name),
    notes                = COALESCE(store_master.notes, EXCLUDED.notes),
    storefront_photo_url = COALESCE(store_master.storefront_photo_url, EXCLUDED.storefront_photo_url),
    store_type           = COALESCE(store_master.store_type, EXCLUDED.store_type),
    business_id          = COALESCE(store_master.business_id, EXCLUDED.business_id);

  RETURN NEW;
END;
$$;

-- 3. Derive the field assignment from the capturing user, reusing existing assignment models
CREATE OR REPLACE FUNCTION public.assign_field_captured_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ambassador_id uuid;
  v_driver_id uuid;
  v_assigned boolean := false;
BEGIN
  IF NEW.captured_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ambassador identity
  SELECT a.id INTO v_ambassador_id
  FROM ambassadors a
  WHERE a.user_id = NEW.captured_by_user_id
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
    -- Driver / biker identity
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
$$;

DROP TRIGGER IF EXISTS trg_field_capture_assignment ON public.stores;
CREATE TRIGGER trg_field_capture_assignment
AFTER INSERT ON public.stores
FOR EACH ROW
WHEN (NEW.captured_by_user_id IS NOT NULL)
EXECUTE FUNCTION public.assign_field_captured_store();

-- 4. Repair existing field-captured rows from their original capture records
UPDATE store_master sm
   SET phone                = COALESCE(sm.phone, NULLIF(btrim(COALESCE(s.phone,'')),'')),
       contact_name         = COALESCE(sm.contact_name, NULLIF(btrim(COALESCE(s.primary_contact_name,'')),'')),
       owner_name           = COALESCE(sm.owner_name, NULLIF(btrim(COALESCE(s.primary_contact_name,'')),'')),
       notes                = COALESCE(sm.notes, NULLIF(btrim(COALESCE(s.notes,'')),'')),
       storefront_photo_url = COALESCE(sm.storefront_photo_url, s.storefront_photo_url),
       business_id          = COALESCE(sm.business_id, 'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid)
  FROM stores s
 WHERE s.id = sm.id
   AND s.captured_by_user_id IS NOT NULL;

UPDATE store_master sm
   SET field_assignment_status = CASE
     WHEN EXISTS (
       SELECT 1 FROM ambassador_assignments aa
       WHERE aa.store_id = sm.id AND aa.active IS TRUE AND aa.unassigned_at IS NULL
     ) OR EXISTS (
       SELECT 1 FROM driver_assignments da
       WHERE da.store_id = sm.id AND da.is_active IS TRUE
     ) THEN 'assigned' ELSE 'assignment_required' END
  FROM stores s
 WHERE s.id = sm.id
   AND s.captured_by_user_id IS NOT NULL;
