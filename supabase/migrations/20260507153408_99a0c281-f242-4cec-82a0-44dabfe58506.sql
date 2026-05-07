DO $$
DECLARE
  v_cj_id uuid := '5b96e04d-6673-4f3b-9d90-ad0442761787';
  v_vael_id uuid := '93fd89f4-2b9b-4c91-9dfc-8a2fd7d5dc32';
  v_tony_id uuid := 'a9a4be9b-531d-4bf3-bd38-3f48fbe7be2b';
  v_session_cj uuid := gen_random_uuid();
  v_session_vael uuid := gen_random_uuid();
  v_session_tony uuid := gen_random_uuid();
BEGIN
  -- ============ CJ: address backfill ============
  INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, session_label, session_id, notes)
  SELECT 'manual_backfill', 'stores', id,
         to_jsonb(s.*),
         jsonb_build_object('address_street','2534 8th Avenue'),
         'cj_2534_8th_ave_manual_backfill', v_session_cj,
         'Address extracted from store name parens'
  FROM stores s WHERE id = v_cj_id;

  INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, session_label, session_id, notes)
  SELECT 'manual_backfill', 'store_master', id,
         to_jsonb(sm.*),
         jsonb_build_object('address','2534 8th Avenue'),
         'cj_2534_8th_ave_manual_backfill', v_session_cj,
         'Mirror'
  FROM store_master sm WHERE id = v_cj_id;

  UPDATE stores SET address_street = '2534 8th Avenue', updated_at = now() WHERE id = v_cj_id;
  UPDATE store_master SET address = '2534 8th Avenue', updated_at = now() WHERE id = v_cj_id;

  -- ============ VAEL: phone enrichment ============
  INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, session_label, session_id, notes)
  SELECT 'phone_enrichment', 'stores', id,
         to_jsonb(s.*),
         jsonb_build_object('phone','917-771-1661'),
         'vael_deli_phone_enrichment', v_session_vael,
         'Owner Mike phone from store notes'
  FROM stores s WHERE id = v_vael_id;

  INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, session_label, session_id, notes)
  SELECT 'phone_enrichment', 'store_master', id,
         to_jsonb(sm.*),
         jsonb_build_object('phone','917-771-1661'),
         'vael_deli_phone_enrichment', v_session_vael,
         'Mirror'
  FROM store_master sm WHERE id = v_vael_id;

  UPDATE stores SET phone = '917-771-1661', updated_at = now() WHERE id = v_vael_id;
  UPDATE store_master SET phone = '917-771-1661', updated_at = now() WHERE id = v_vael_id;

  -- ============ TONY: phone enrichment ============
  INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, session_label, session_id, notes)
  SELECT 'phone_enrichment', 'stores', id,
         to_jsonb(s.*),
         jsonb_build_object('phone','917-960-9274'),
         'tony_deli_phone_enrichment', v_session_tony,
         'Owner Tony phone from store notes'
  FROM stores s WHERE id = v_tony_id;

  INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, session_label, session_id, notes)
  SELECT 'phone_enrichment', 'store_master', id,
         to_jsonb(sm.*),
         jsonb_build_object('phone','917-960-9274'),
         'tony_deli_phone_enrichment', v_session_tony,
         'Mirror'
  FROM store_master sm WHERE id = v_tony_id;

  UPDATE stores SET phone = '917-960-9274', updated_at = now() WHERE id = v_tony_id;
  UPDATE store_master SET phone = '917-960-9274', updated_at = now() WHERE id = v_tony_id;

  RAISE NOTICE 'Sessions: cj=%, vael=%, tony=%', v_session_cj, v_session_vael, v_session_tony;
END $$;