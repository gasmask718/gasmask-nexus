DO $$
DECLARE
  v_run_id uuid := gen_random_uuid();
  v_restored int;
  v_notes_back int := 0;
  v_inv_back int := 0;
  v_alt_reverted int;
  v_ids uuid[] := ARRAY[
    '1903c565-bf21-47f4-afcd-0b8823a918d1',
    'd52e25ef-ecf1-4c0b-a9ed-22863c82bce0',
    'eef524fa-a38b-45de-a5c8-2015245ebb7f',
    '23358234-6f57-42aa-8b66-c60dddd1451f',
    '99b5e7df-891a-4575-838f-17f000527f46',
    'f82f9548-1a39-4e64-abed-ad3eef12d41f',
    '5f22d1bd-cbee-47df-bf3c-88f8bae979b6'
  ]::uuid[];
BEGIN
  RAISE NOTICE 'A4 restore run_id: %', v_run_id;

  INSERT INTO stores (id,name,type,address_street,address_city,address_state,address_zip,address_country,lat,lng,primary_contact_name,phone,alt_phone,email,notes,status,responsiveness,sticker_status,tags,created_at,updated_at,health_score,region_id,market_code,open_date,last_active_date,performance_tier,performance_score,last_performance_update,last_visit_date,last_visit_driver_id,visit_frequency_target,visit_risk_level,store_code,neighborhood,boro,wholesaler_name,connected_group_id,sells_flowers,prime_time_energy,rpa_status,notes_overview,notes_old,special_information,created_by,company_id,deleted_at,sticker_last_seen_at,sticker_taken_down,sticker_taken_down_at,sticker_door,sticker_instore,sticker_phone,sticker_door_put_on_at,sticker_door_last_seen_at,sticker_door_taken_down_at,sticker_door_note,sticker_instore_put_on_at,sticker_instore_last_seen_at,sticker_instore_taken_down_at,sticker_instore_note,sticker_phone_put_on_at,sticker_phone_last_seen_at,sticker_phone_taken_down_at,sticker_phone_note,payment_type,is_simulation,member_since,geo_id,created_by_user_id,ingestion_source,deleted_reason,assigned_ambassador_id,activated_at,source,outreach_notes,last_classified_at,is_test_data,reactivation_priority,reactivation_attempts,last_reactivation_attempt_at,reactivated_at,captured_by_user_id,captured_at,captured_role,approval_status,approved_by_user_id,approved_at,rejection_reason,storefront_photo_url,neighborhood_source,created_by_run_id,geocode_confidence,last_update_run_id)
  SELECT id,name,type,address_street,address_city,address_state,address_zip,address_country,lat,lng,primary_contact_name,phone,alt_phone,email,notes,status,responsiveness,sticker_status,tags,created_at,now(),health_score,region_id,market_code,open_date,last_active_date,performance_tier,performance_score,last_performance_update,last_visit_date,last_visit_driver_id,visit_frequency_target,visit_risk_level,store_code,neighborhood,boro,wholesaler_name,connected_group_id,sells_flowers,prime_time_energy,rpa_status,notes_overview,notes_old,special_information,created_by,company_id,NULL::timestamptz,sticker_last_seen_at,sticker_taken_down,sticker_taken_down_at,sticker_door,sticker_instore,sticker_phone,sticker_door_put_on_at,sticker_door_last_seen_at,sticker_door_taken_down_at,sticker_door_note,sticker_instore_put_on_at,sticker_instore_last_seen_at,sticker_instore_taken_down_at,sticker_instore_note,sticker_phone_put_on_at,sticker_phone_last_seen_at,sticker_phone_taken_down_at,sticker_phone_note,payment_type,is_simulation,member_since,geo_id,created_by_user_id,ingestion_source,'restored_by_run_'||v_run_id::text,assigned_ambassador_id,activated_at,source,outreach_notes,last_classified_at,is_test_data,reactivation_priority,reactivation_attempts,last_reactivation_attempt_at,reactivated_at,captured_by_user_id,captured_at,captured_role,approval_status,approved_by_user_id,approved_at,rejection_reason,storefront_photo_url,neighborhood_source,created_by_run_id,geocode_confidence,v_run_id
  FROM _dedup_snap_f7b3c284
  WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_restored = ROW_COUNT;

  UPDATE store_notes n
  SET store_id = snap.store_id
  FROM _dedup_snap_notes_f7b3c284 snap
  WHERE n.id = snap.id AND snap.store_id = ANY(v_ids);
  GET DIAGNOSTICS v_notes_back = ROW_COUNT;

  UPDATE invoices i
  SET store_id = snap.store_id
  FROM _dedup_snap_invoices_f7b3c284 snap
  WHERE i.id = snap.id AND snap.store_id = ANY(v_ids);
  GET DIAGNOSTICS v_inv_back = ROW_COUNT;

  WITH del_phones AS (
    SELECT survivor_store_id, regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') AS digits
    FROM _dedup_snap_f7b3c284
    WHERE id = ANY(v_ids) AND phone IS NOT NULL AND phone <> '' AND phone <> '—'
  )
  UPDATE stores s
  SET alt_phone = NULL, updated_at = now(), last_update_run_id = v_run_id
  FROM del_phones dp
  WHERE s.id = dp.survivor_store_id
    AND s.alt_phone IS NOT NULL
    AND regexp_replace(s.alt_phone, '[^0-9]', '', 'g') = dp.digits;
  GET DIAGNOSTICS v_alt_reverted = ROW_COUNT;

  RAISE NOTICE 'A4 RESTORE COMPLETE: RESTORED=% NOTES_BACK=% INV_BACK=% ALT_REVERTED=% RUN_ID=%',
    v_restored, v_notes_back, v_inv_back, v_alt_reverted, v_run_id;
END$$;