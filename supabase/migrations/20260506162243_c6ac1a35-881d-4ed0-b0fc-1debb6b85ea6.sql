-- ============================================
-- PHASE 1: Pass 2 regex extraction on stores
-- ============================================
DO $$
DECLARE
  v_session_id uuid := gen_random_uuid();
  v_session_label text := 'address_backfill_pass2_regex_extraction';
  v_logged int;
  v_applied int;
BEGIN
  CREATE TEMP TABLE pass2_apply ON COMMIT DROP AS
  WITH empty_stores AS (
    SELECT s.id, s.name, s.address_street
    FROM stores s
    WHERE s.deleted_at IS NULL
      AND COALESCE(TRIM(s.address_street),'') = ''
  ),
  prefix_extractions AS (
    SELECT
      e.id AS store_id,
      e.name AS current_name,
      'prefix' AS pattern_type,
      TRIM((regexp_match(e.name, '^\((\d[\d\- ]*\s+[^)]+)\)'))[1]) AS extracted_address
    FROM empty_stores e
    WHERE e.name ~ '^\(\d[\d\- ]*\s+'
  ),
  suffix_extractions AS (
    SELECT
      e.id AS store_id,
      e.name AS current_name,
      'suffix' AS pattern_type,
      TRIM((regexp_match(e.name, '\((\d[\d\- ]*\s+[^)]+)\)'))[1]) AS extracted_address
    FROM empty_stores e
    WHERE e.name ~ '\(\d[\d\- ]*\s+[A-Za-z]'
      AND e.id NOT IN (SELECT store_id FROM prefix_extractions)
  )
  SELECT * FROM (
    SELECT * FROM prefix_extractions
    UNION ALL
    SELECT * FROM suffix_extractions
  ) combined
  WHERE extracted_address IS NOT NULL
    AND length(extracted_address) BETWEEN 5 AND 80
    AND extracted_address ~ '\d';

  INSERT INTO dynasty_change_log
    (change_type, entity_type, entity_id, before_data, after_data,
     performed_at, notes, session_label, session_id)
  SELECT
    'address_backfill_pass2',
    'stores',
    p.store_id,
    jsonb_build_object(
      'name', s.name,
      'address_street', s.address_street,
      'address_city', s.address_city,
      'address_state', s.address_state,
      'address_zip', s.address_zip
    ),
    jsonb_build_object(
      'name', s.name,
      'address_street', p.extracted_address,
      'address_city', s.address_city,
      'address_state', 'NY',
      'address_zip', s.address_zip,
      'pattern_type', p.pattern_type,
      'extracted_via', 'regex_pass2'
    ),
    now(),
    'Pass 2: Extracted address from name field via regex (' || p.pattern_type || ' pattern). Name kept unchanged. State defaulted to NY.',
    v_session_label,
    v_session_id
  FROM pass2_apply p
  JOIN stores s ON s.id = p.store_id
  WHERE s.deleted_at IS NULL
    AND COALESCE(TRIM(s.address_street),'') = '';
  GET DIAGNOSTICS v_logged = ROW_COUNT;

  UPDATE stores s
  SET address_street = p.extracted_address,
      address_state = COALESCE(NULLIF(TRIM(s.address_state),''), 'NY'),
      updated_at = now()
  FROM pass2_apply p
  WHERE s.id = p.store_id
    AND s.deleted_at IS NULL
    AND COALESCE(TRIM(s.address_street),'') = '';
  GET DIAGNOSTICS v_applied = ROW_COUNT;

  RAISE NOTICE 'Pass 2 stores: logged=%, applied=%, session=%', v_logged, v_applied, v_session_id;
END $$;

-- ============================================
-- PHASE 3: Mirror Pass 2 to store_master
-- ============================================
DO $$
DECLARE
  v_session_id uuid := gen_random_uuid();
  v_session_label text := 'address_backfill_pass2_mirror_to_master';
  v_logged int;
  v_applied int;
BEGIN
  CREATE TEMP TABLE pass2_store_ids ON COMMIT DROP AS
  SELECT DISTINCT entity_id::uuid AS store_id
  FROM dynasty_change_log
  WHERE session_label = 'address_backfill_pass2_regex_extraction'
    AND entity_type = 'stores';

  INSERT INTO dynasty_change_log
    (change_type, entity_type, entity_id, before_data, after_data,
     performed_at, notes, session_label, session_id)
  SELECT
    'address_backfill_pass2_mirror',
    'store_master',
    sm.id,
    jsonb_build_object(
      'address', sm.address,
      'city', sm.city,
      'state', sm.state,
      'zip', sm.zip
    ),
    jsonb_build_object(
      'address', s.address_street,
      'city', sm.city,
      'state', 'NY',
      'zip', sm.zip
    ),
    now(),
    'Mirror Pass 2 to store_master',
    v_session_label,
    v_session_id
  FROM pass2_store_ids p
  JOIN store_master sm ON sm.id = p.store_id
  JOIN stores s ON s.id = p.store_id
  WHERE COALESCE(TRIM(sm.address),'') = ''
    AND COALESCE(TRIM(s.address_street),'') <> '';
  GET DIAGNOSTICS v_logged = ROW_COUNT;

  UPDATE store_master sm
  SET address = s.address_street,
      state = COALESCE(NULLIF(TRIM(sm.state),''), 'NY'),
      updated_at = now()
  FROM stores s
  WHERE sm.id = s.id
    AND sm.id IN (SELECT store_id FROM pass2_store_ids)
    AND COALESCE(TRIM(sm.address),'') = ''
    AND COALESCE(TRIM(s.address_street),'') <> '';
  GET DIAGNOSTICS v_applied = ROW_COUNT;

  RAISE NOTICE 'Pass 2 mirror: logged=%, applied=%, session=%', v_logged, v_applied, v_session_id;
END $$;