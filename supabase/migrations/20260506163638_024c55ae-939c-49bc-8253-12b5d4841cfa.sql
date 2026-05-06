DO $$
DECLARE
  v_session_id uuid := gen_random_uuid();
  v_session_label text := 'address_backfill_manual_2484_pitkin';
  v_store_id uuid := '93ff1365-4eb0-493a-9a1d-1e645db6c522';
BEGIN
  INSERT INTO dynasty_change_log
    (change_type, entity_type, entity_id, before_data, after_data,
     performed_at, notes, session_label, session_id)
  SELECT
    'address_backfill_manual', 'stores', s.id,
    jsonb_build_object('address_street', s.address_street, 'address_city', s.address_city,
                       'address_state', s.address_state, 'address_zip', s.address_zip),
    jsonb_build_object('address_street', '2484 Pitkin Ave', 'address_city', 'Brooklyn',
                       'address_state', 'NY', 'address_zip', '11208'),
    now(),
    'Manual fix: EBB Pitkin Express Deli Grill. Pass 1 missed because CSV phone was truncated.',
    v_session_label, v_session_id
  FROM stores s WHERE s.id = v_store_id AND s.deleted_at IS NULL;

  UPDATE stores
  SET address_street = '2484 Pitkin Ave', address_city = 'Brooklyn',
      address_state = 'NY', address_zip = '11208', updated_at = now()
  WHERE id = v_store_id AND deleted_at IS NULL;

  INSERT INTO dynasty_change_log
    (change_type, entity_type, entity_id, before_data, after_data,
     performed_at, notes, session_label, session_id)
  SELECT
    'address_backfill_manual_mirror', 'store_master', sm.id,
    jsonb_build_object('address', sm.address, 'city', sm.city, 'state', sm.state, 'zip', sm.zip),
    jsonb_build_object('address', '2484 Pitkin Ave', 'city', 'Brooklyn', 'state', 'NY', 'zip', '11208'),
    now(), 'Manual mirror to store_master', v_session_label, v_session_id
  FROM store_master sm WHERE sm.id = v_store_id;

  UPDATE store_master
  SET address = '2484 Pitkin Ave', city = 'Brooklyn', state = 'NY', zip = '11208', updated_at = now()
  WHERE id = v_store_id;

  RAISE NOTICE 'Fixed 2484 Pitkin. Session: %', v_session_id;
END $$;