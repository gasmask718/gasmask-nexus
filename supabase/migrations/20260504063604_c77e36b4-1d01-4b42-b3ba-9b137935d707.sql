CREATE OR REPLACE FUNCTION public.preview_store_merge_group(p_group_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group_record record;
  v_normalized_address text;
  v_store_ids uuid[];
  v_override_winner uuid;
  v_winner_id uuid;
  v_winner_record jsonb;
  v_losers jsonb := '[]'::jsonb;
  v_consolidation jsonb := '[]'::jsonb;
  v_contacts_to_create jsonb := '[]'::jsonb;
  v_loser_ids uuid[];
  v_loser_id uuid;
  v_loser_data jsonb;
  v_winner_eff_name text;
  v_winner_eff_phone text;
  v_winner_norm_name text;
  v_winner_norm_phone text;
  v_loser_eff_name text;
  v_loser_eff_phone text;
  v_loser_eff_email text;
  v_loser_norm_name text;
  v_loser_norm_phone text;
  v_is_typo boolean;
  v_existing_contact boolean;
  v_field record;
  v_winner_field_value text;
  v_best_loser_id uuid;
  v_best_loser_value text;
  v_best_loser_updated timestamptz;
  -- Phase D
  v_fk record;
  v_fk_results jsonb := '[]'::jsonb;
  v_rows_total bigint;
  v_rows_dedup bigint;
  v_rows_repoint bigint;
  v_sample_skipped jsonb;
  v_sql text;
  v_dedup_rule text;
  v_total_repoint bigint := 0;
  v_total_dedup_skip bigint := 0;
  v_tables_affected int := 0;
  v_tables_with_dedup int := 0;
  -- Phase E
  v_stores_count int := 0;
  v_master_count int := 0;
  v_drift_warnings jsonb := '[]'::jsonb;
  v_in_stores boolean;
  v_in_master boolean;
  -- Phase F
  v_estimated_log bigint;
  v_warnings jsonb := '[]'::jsonb;
  v_winner_state text;
BEGIN
  -- 1. Resolve group → store_ids
  SELECT duplicate_group_id, normalized_address, store_ids INTO v_group_record
  FROM detect_store_address_duplicates() d
  WHERE d.duplicate_group_id = p_group_id LIMIT 1;

  IF v_group_record IS NULL THEN
    RETURN jsonb_build_object('error','group_not_found','group_id',p_group_id);
  END IF;

  v_normalized_address := v_group_record.normalized_address;
  v_store_ids := v_group_record.store_ids;

  -- 2. Override winner?
  SELECT manual_winner_store_id INTO v_override_winner
  FROM dynasty_merge_overrides WHERE duplicate_group_id = p_group_id LIMIT 1;

  -- 3. Pick winner
  IF v_override_winner IS NOT NULL AND v_override_winner = ANY(v_store_ids) THEN
    v_winner_id := v_override_winner;
  ELSE
    SELECT a.store_id INTO v_winner_id
    FROM analyze_store_duplicate_groups() a
    WHERE a.duplicate_group_id = p_group_id
    ORDER BY a.total_activity_score DESC NULLS LAST, a.created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_winner_id IS NULL THEN
    RETURN jsonb_build_object('error','no_winner_found','group_id',p_group_id);
  END IF;

  v_loser_ids := ARRAY(SELECT unnest(v_store_ids) EXCEPT SELECT v_winner_id);

  -- 4. Winner effective name/phone
  SELECT
    COALESCE(NULLIF(TRIM(sm.store_name),''), NULLIF(TRIM(s.name),'')),
    COALESCE(NULLIF(TRIM(s.phone),''), NULLIF(TRIM(sm.phone),''))
  INTO v_winner_eff_name, v_winner_eff_phone
  FROM (SELECT v_winner_id AS id) k
  LEFT JOIN stores s ON s.id=k.id
  LEFT JOIN store_master sm ON sm.id=k.id;

  v_winner_norm_name  := lower(COALESCE(TRIM(v_winner_eff_name),''));
  v_winner_norm_phone := COALESCE(regexp_replace(COALESCE(v_winner_eff_phone,''),'\D','','g'),'');

  -- 5. Winner snapshot
  SELECT jsonb_build_object(
    'store_id', v_winner_id,
    'effective_name', v_winner_eff_name,
    'name_source', CASE
      WHEN NULLIF(TRIM(sm.store_name),'') IS NOT NULL THEN 'store_master.store_name'
      WHEN NULLIF(TRIM(s.name),'') IS NOT NULL THEN 'stores.name' ELSE 'none' END,
    'effective_phone', v_winner_eff_phone,
    'phone_source', CASE
      WHEN NULLIF(TRIM(s.phone),'') IS NOT NULL THEN 'stores.phone'
      WHEN NULLIF(TRIM(sm.phone),'') IS NOT NULL THEN 'store_master.phone' ELSE 'none' END,
    'effective_email', COALESCE(NULLIF(TRIM(s.email),''), NULLIF(TRIM(sm.email),'')),
    'email_source', CASE
      WHEN NULLIF(TRIM(s.email),'') IS NOT NULL THEN 'stores.email'
      WHEN NULLIF(TRIM(sm.email),'') IS NOT NULL THEN 'store_master.email' ELSE 'none' END,
    'effective_address', COALESCE(NULLIF(TRIM(s.address_street),''), NULLIF(TRIM(sm.address),'')),
    'address_source', CASE
      WHEN NULLIF(TRIM(s.address_street),'') IS NOT NULL THEN 'stores.address_street'
      WHEN NULLIF(TRIM(sm.address),'') IS NOT NULL THEN 'store_master.address' ELSE 'none' END,
    'effective_city',  COALESCE(NULLIF(TRIM(s.address_city),''),  NULLIF(TRIM(sm.city),'')),
    'effective_state', COALESCE(NULLIF(TRIM(s.address_state),''), NULLIF(TRIM(sm.state),'')),
    'effective_zip',   COALESCE(NULLIF(TRIM(s.address_zip),''),   NULLIF(TRIM(sm.zip),'')),
    'stores_exists', s.id IS NOT NULL,
    'store_master_exists', sm.id IS NOT NULL,
    'created_at', LEAST(s.created_at, sm.created_at),
    'is_override', (v_override_winner IS NOT NULL AND v_override_winner = v_winner_id),
    'activity_score', (
      SELECT a.total_activity_score FROM analyze_store_duplicate_groups() a
      WHERE a.store_id = v_winner_id AND a.duplicate_group_id = p_group_id LIMIT 1
    )
  ) INTO v_winner_record
  FROM (SELECT v_winner_id AS id) k
  LEFT JOIN stores s ON s.id=k.id
  LEFT JOIN store_master sm ON sm.id=k.id;

  v_winner_state := COALESCE((SELECT NULLIF(TRIM(s.address_state),'') FROM stores s WHERE s.id=v_winner_id),
                             (SELECT NULLIF(TRIM(sm.state),'') FROM store_master sm WHERE sm.id=v_winner_id));

  -- 6. Loser loop (Phase A/B)
  FOREACH v_loser_id IN ARRAY v_store_ids LOOP
    CONTINUE WHEN v_loser_id = v_winner_id;

    SELECT
      COALESCE(NULLIF(TRIM(sm.store_name),''), NULLIF(TRIM(s.name),'')),
      COALESCE(NULLIF(TRIM(s.phone),''), NULLIF(TRIM(sm.phone),'')),
      COALESCE(NULLIF(TRIM(s.email),''), NULLIF(TRIM(sm.email),''))
    INTO v_loser_eff_name, v_loser_eff_phone, v_loser_eff_email
    FROM (SELECT v_loser_id AS id) k
    LEFT JOIN stores s ON s.id=k.id
    LEFT JOIN store_master sm ON sm.id=k.id;

    v_loser_norm_name  := lower(COALESCE(TRIM(v_loser_eff_name),''));
    v_loser_norm_phone := COALESCE(regexp_replace(COALESCE(v_loser_eff_phone,''),'\D','','g'),'');
    v_is_typo := (v_loser_norm_name = v_winner_norm_name) AND (v_loser_norm_phone = v_winner_norm_phone);

    SELECT jsonb_build_object(
      'store_id', v_loser_id,
      'effective_name', v_loser_eff_name,
      'effective_phone', v_loser_eff_phone,
      'effective_email', v_loser_eff_email,
      'normalized_name', v_loser_norm_name,
      'normalized_phone', v_loser_norm_phone,
      'classification', CASE WHEN v_is_typo THEN 'typo_duplicate' ELSE 'real_person_contact' END,
      'stores_exists', s.id IS NOT NULL,
      'store_master_exists', sm.id IS NOT NULL,
      'created_at', LEAST(s.created_at, sm.created_at),
      'updated_at', GREATEST(s.updated_at, sm.updated_at),
      'activity_score', (
        SELECT a.total_activity_score FROM analyze_store_duplicate_groups() a
        WHERE a.store_id = v_loser_id AND a.duplicate_group_id = p_group_id LIMIT 1
      )
    ) INTO v_loser_data
    FROM (SELECT v_loser_id AS id) k
    LEFT JOIN stores s ON s.id=k.id
    LEFT JOIN store_master sm ON sm.id=k.id;

    v_losers := v_losers || v_loser_data;

    IF NOT v_is_typo THEN
      SELECT EXISTS (
        SELECT 1 FROM store_contacts sc
        WHERE sc.store_id = v_winner_id
          AND lower(COALESCE(TRIM(sc.name),'')) = v_loser_norm_name
          AND COALESCE(regexp_replace(COALESCE(sc.phone,''),'\D','','g'),'') = v_loser_norm_phone
      ) INTO v_existing_contact;

      v_contacts_to_create := v_contacts_to_create || jsonb_build_object(
        'from_loser_id', v_loser_id,
        'name', v_loser_eff_name,
        'phone', NULLIF(v_loser_norm_phone,''),
        'email', v_loser_eff_email,
        'would_be_skipped', v_existing_contact,
        'skip_reason', CASE WHEN v_existing_contact THEN 'duplicate_contact_already_on_winner' ELSE NULL END
      );
    END IF;
  END LOOP;

  -- 7. Phase C field consolidation
  FOR v_field IN
    SELECT * FROM (VALUES
      ('phone','stores','phone'),('email','stores','email'),
      ('store_name','store_master','store_name'),('owner_name','store_master','owner_name'),
      ('contact_name','store_master','contact_name'),('address','store_master','address'),
      ('city','store_master','city'),('state','store_master','state'),
      ('zip','store_master','zip'),('nickname','store_master','nickname')
    ) AS t(field_label, target_table, target_column)
  LOOP
    EXECUTE format('SELECT NULLIF(TRIM(%I::text),'''') FROM %I WHERE id=$1',
      v_field.target_column, v_field.target_table)
    INTO v_winner_field_value USING v_winner_id;

    IF v_winner_field_value IS NOT NULL THEN CONTINUE; END IF;

    EXECUTE format($q$
      SELECT id, NULLIF(TRIM(%I::text),'') AS val, updated_at
      FROM %I WHERE id = ANY($1) AND id <> $2
        AND NULLIF(TRIM(%I::text),'') IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST LIMIT 1
    $q$, v_field.target_column, v_field.target_table, v_field.target_column)
    INTO v_best_loser_id, v_best_loser_value, v_best_loser_updated
    USING v_store_ids, v_winner_id;

    IF v_best_loser_value IS NOT NULL THEN
      v_consolidation := v_consolidation || jsonb_build_object(
        'field', v_field.field_label,
        'target_table', v_field.target_table,
        'target_column', v_field.target_column,
        'winner_current_value', NULL,
        'planned_value', v_best_loser_value,
        'source_loser_id', v_best_loser_id,
        'source_updated_at', v_best_loser_updated
      );
    END IF;
  END LOOP;

  -- ============================================================
  -- PHASE D: FK Re-point Preview
  -- ============================================================
  IF array_length(v_loser_ids,1) > 0 THEN
    FOR v_fk IN
      SELECT
        c.conrelid::regclass::text AS ref_table_full,
        n.nspname AS ref_schema,
        cl.relname AS ref_table,
        a.attname AS ref_column,
        c.confrelid::regclass::text AS target_table
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype='f'
        AND c.confrelid::regclass::text IN ('stores','store_master','public.stores','public.store_master')
        AND n.nspname='public'
    LOOP
      v_rows_total := 0; v_rows_dedup := 0; v_sample_skipped := '[]'::jsonb;
      v_dedup_rule := NULL;

      -- total rows referencing losers
      v_sql := format('SELECT COUNT(*) FROM %I.%I WHERE %I = ANY($1)',
        v_fk.ref_schema, v_fk.ref_table, v_fk.ref_column);
      BEGIN
        EXECUTE v_sql INTO v_rows_total USING v_loser_ids;
      EXCEPTION WHEN OTHERS THEN v_rows_total := 0;
      END;

      IF v_rows_total = 0 THEN CONTINUE; END IF;

      -- entity-specific dedup rules
      IF v_fk.ref_table = 'store_notes' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'normalized note_text matches existing on winner';
        EXECUTE $$
          SELECT COUNT(*),
            COALESCE(jsonb_agg(LEFT(l.note_text,80)) FILTER (WHERE l.note_text IS NOT NULL), '[]'::jsonb)
          FROM store_notes l
          WHERE l.store_id = ANY($1)
            AND EXISTS (
              SELECT 1 FROM store_notes w
              WHERE w.store_id = $2
                AND lower(regexp_replace(COALESCE(w.note_text,''), '\s+', ' ', 'g')) =
                    lower(regexp_replace(COALESCE(l.note_text,''), '\s+', ' ', 'g'))
            )
        $$ INTO v_rows_dedup, v_sample_skipped USING v_loser_ids, v_winner_id;
        v_sample_skipped := (SELECT jsonb_agg(x) FROM (SELECT jsonb_array_elements(v_sample_skipped) x LIMIT 5) sub);
      ELSIF v_fk.ref_table = 'invoices' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'duplicate invoice_number on winner';
        EXECUTE $$
          SELECT COUNT(*),
            COALESCE(jsonb_agg(l.invoice_number) FILTER (WHERE l.invoice_number IS NOT NULL), '[]'::jsonb)
          FROM invoices l
          WHERE l.store_id = ANY($1) AND l.invoice_number IS NOT NULL
            AND EXISTS (SELECT 1 FROM invoices w WHERE w.store_id=$2 AND w.invoice_number = l.invoice_number)
        $$ INTO v_rows_dedup, v_sample_skipped USING v_loser_ids, v_winner_id;
        v_sample_skipped := (SELECT jsonb_agg(x) FROM (SELECT jsonb_array_elements(v_sample_skipped) x LIMIT 5) sub);
      ELSIF v_fk.ref_table = 'orders' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'duplicate short_code or external_ref on winner';
        EXECUTE $$
          SELECT COUNT(*),
            COALESCE(jsonb_agg(COALESCE(l.short_code, l.external_ref)) FILTER (WHERE COALESCE(l.short_code,l.external_ref) IS NOT NULL), '[]'::jsonb)
          FROM orders l
          WHERE l.store_id = ANY($1)
            AND (
              (l.short_code IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=$2 AND w.short_code=l.short_code))
              OR (l.external_ref IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=$2 AND w.external_ref=l.external_ref))
            )
        $$ INTO v_rows_dedup, v_sample_skipped USING v_loser_ids, v_winner_id;
        v_sample_skipped := (SELECT jsonb_agg(x) FROM (SELECT jsonb_array_elements(v_sample_skipped) x LIMIT 5) sub);
      ELSIF v_fk.ref_table = 'communication_events' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'same created_at(sec) + channel + event_type on winner';
        EXECUTE $$
          SELECT COUNT(*)
          FROM communication_events l
          WHERE l.store_id = ANY($1)
            AND EXISTS (
              SELECT 1 FROM communication_events w
              WHERE w.store_id=$2
                AND date_trunc('second', w.created_at) = date_trunc('second', l.created_at)
                AND w.channel IS NOT DISTINCT FROM l.channel
                AND w.event_type IS NOT DISTINCT FROM l.event_type
            )
        $$ INTO v_rows_dedup USING v_loser_ids, v_winner_id;
      ELSIF v_fk.ref_table = 'manual_call_logs' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'same created_at(sec) + outcome on winner';
        EXECUTE $$
          SELECT COUNT(*)
          FROM manual_call_logs l
          WHERE l.store_id = ANY($1)
            AND EXISTS (
              SELECT 1 FROM manual_call_logs w
              WHERE w.store_id=$2
                AND date_trunc('second', w.created_at) = date_trunc('second', l.created_at)
                AND w.outcome IS NOT DISTINCT FROM l.outcome
            )
        $$ INTO v_rows_dedup USING v_loser_ids, v_winner_id;
      END IF;

      v_rows_repoint := v_rows_total - COALESCE(v_rows_dedup,0);
      v_total_repoint := v_total_repoint + v_rows_repoint;
      v_total_dedup_skip := v_total_dedup_skip + COALESCE(v_rows_dedup,0);
      v_tables_affected := v_tables_affected + 1;
      IF COALESCE(v_rows_dedup,0) > 0 THEN
        v_tables_with_dedup := v_tables_with_dedup + 1;
      END IF;

      v_fk_results := v_fk_results || jsonb_build_object(
        'table_name', v_fk.ref_table,
        'referencing_column', v_fk.ref_column,
        'target_table', v_fk.target_table,
        'rows_total', v_rows_total,
        'rows_to_repoint', v_rows_repoint,
        'rows_to_skip_dedup', COALESCE(v_rows_dedup,0),
        'skip_reason', v_dedup_rule,
        'sample_skipped_values', COALESCE(v_sample_skipped,'[]'::jsonb),
        'is_money_table', v_fk.ref_table IN ('store_payments','store_transactions','store_wallet','commission_ledger','invoices')
      );

      -- High-impact warning
      IF v_rows_repoint >= 50 THEN
        v_warnings := v_warnings || jsonb_build_object(
          'level','warn',
          'message', format('High-impact: %s has %s rows to re-point (review carefully)', v_fk.ref_table, v_rows_repoint)
        );
      END IF;
      IF v_fk.ref_table IN ('store_payments','store_transactions','store_wallet','commission_ledger') AND v_rows_repoint > 0 THEN
        v_warnings := v_warnings || jsonb_build_object(
          'level','warn',
          'message', format('Money table affected: %s has %s rows, no auto-dedup applies', v_fk.ref_table, v_rows_repoint)
        );
      END IF;
    END LOOP;
  END IF;

  -- Sort fk results by rows_to_repoint desc
  v_fk_results := COALESCE((
    SELECT jsonb_agg(elem ORDER BY (elem->>'rows_to_repoint')::bigint DESC)
    FROM jsonb_array_elements(v_fk_results) elem
  ), '[]'::jsonb);

  -- ============================================================
  -- PHASE E: Soft-delete preview
  -- ============================================================
  IF array_length(v_loser_ids,1) > 0 THEN
    SELECT COUNT(*) INTO v_stores_count FROM stores WHERE id = ANY(v_loser_ids) AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_master_count FROM store_master WHERE id = ANY(v_loser_ids) AND deleted_at IS NULL;

    FOREACH v_loser_id IN ARRAY v_loser_ids LOOP
      SELECT EXISTS(SELECT 1 FROM stores WHERE id=v_loser_id AND deleted_at IS NULL) INTO v_in_stores;
      SELECT EXISTS(SELECT 1 FROM store_master WHERE id=v_loser_id AND deleted_at IS NULL) INTO v_in_master;
      IF v_in_stores AND NOT v_in_master THEN
        v_drift_warnings := v_drift_warnings || jsonb_build_object(
          'loser_id', v_loser_id, 'message', 'Exists in stores but not store_master');
      ELSIF v_in_master AND NOT v_in_stores THEN
        v_drift_warnings := v_drift_warnings || jsonb_build_object(
          'loser_id', v_loser_id, 'message', 'Exists in store_master but not stores');
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(v_drift_warnings) > 0 THEN
    v_warnings := v_warnings || jsonb_build_object(
      'level','warn',
      'message', format('Drift: %s loser(s) exist in only one of stores/store_master', jsonb_array_length(v_drift_warnings))
    );
  END IF;

  -- Field-level winner data quality warning
  IF v_winner_state IS NOT NULL AND length(v_winner_state) > 2 THEN
    v_warnings := v_warnings || jsonb_build_object(
      'level','info',
      'message', format('Winner state value "%s" is not a 2-letter code (separate cleanup)', v_winner_state)
    );
  END IF;

  -- ============================================================
  -- PHASE F: change_log estimate
  -- ============================================================
  v_estimated_log :=
    1 -- winner_selection
    + jsonb_array_length(v_losers) -- typo absorbed or contact attempted (one per loser)
    + jsonb_array_length(v_consolidation)
    + v_tables_affected -- one per repoint batch
    + v_total_dedup_skip -- one per dedup skip row
    + v_stores_count + v_master_count -- soft deletes
    + 1; -- session_complete

  -- ============================================================
  -- Final return
  -- ============================================================
  RETURN jsonb_build_object(
    'merge_summary', jsonb_build_object(
      'group_id', p_group_id,
      'normalized_address', v_normalized_address,
      'winner_store_id', v_winner_id,
      'winner_name', v_winner_eff_name,
      'loser_count', COALESCE(array_length(v_loser_ids,1),0),
      'contacts_to_create', (SELECT COUNT(*) FROM jsonb_array_elements(v_contacts_to_create) e
                              WHERE NOT (e->>'would_be_skipped')::boolean),
      'fields_to_consolidate', jsonb_array_length(v_consolidation),
      'tables_to_repoint', v_tables_affected,
      'rows_to_repoint', v_total_repoint,
      'rows_to_skip_dedup', v_total_dedup_skip,
      'soft_deletes_total', v_stores_count + v_master_count,
      'estimated_change_log_writes', v_estimated_log,
      'estimated_total_db_writes',
        v_total_repoint + (v_stores_count + v_master_count)
        + jsonb_array_length(v_consolidation)
        + (SELECT COUNT(*) FROM jsonb_array_elements(v_contacts_to_create) e WHERE NOT (e->>'would_be_skipped')::boolean)
        + v_estimated_log,
      'warnings', v_warnings
    ),
    'group_id', p_group_id,
    'normalized_address', v_normalized_address,
    'group_size', array_length(v_store_ids,1),
    'all_store_ids', to_jsonb(v_store_ids),
    'winner', v_winner_record,
    'losers', v_losers,
    'losers_count', jsonb_array_length(v_losers),
    'typo_duplicates_count', (SELECT COUNT(*) FROM jsonb_array_elements(v_losers) e WHERE e->>'classification'='typo_duplicate'),
    'real_person_contacts_count', (SELECT COUNT(*) FROM jsonb_array_elements(v_losers) e WHERE e->>'classification'='real_person_contact'),
    'contacts_to_create', v_contacts_to_create,
    'contacts_to_skip_count', (SELECT COUNT(*) FROM jsonb_array_elements(v_contacts_to_create) e WHERE (e->>'would_be_skipped')::boolean),
    'field_consolidation', v_consolidation,
    'field_consolidation_count', jsonb_array_length(v_consolidation),
    'phase_d_fk_repoints', v_fk_results,
    'phase_d_summary', jsonb_build_object(
      'total_tables_affected', v_tables_affected,
      'total_rows_to_repoint', v_total_repoint,
      'total_rows_to_skip_dedup', v_total_dedup_skip,
      'tables_with_dedup_skips', v_tables_with_dedup
    ),
    'phase_e_soft_deletes', jsonb_build_object(
      'loser_ids', to_jsonb(v_loser_ids),
      'stores_table_count', v_stores_count,
      'store_master_table_count', v_master_count,
      'total', v_stores_count + v_master_count,
      'drift_warnings', v_drift_warnings
    ),
    'phase_f_change_log', jsonb_build_object(
      'estimated_entries', v_estimated_log,
      'breakdown_by_change_type', jsonb_build_object(
        'merge_winner_selection', 1,
        'merge_typo_absorbed', (SELECT COUNT(*) FROM jsonb_array_elements(v_losers) e WHERE e->>'classification'='typo_duplicate'),
        'merge_contact_created', (SELECT COUNT(*) FROM jsonb_array_elements(v_contacts_to_create) e WHERE NOT (e->>'would_be_skipped')::boolean),
        'merge_field_consolidation', jsonb_array_length(v_consolidation),
        'merge_fk_repoint', v_tables_affected,
        'merge_dedup_skip', v_total_dedup_skip,
        'merge_soft_delete', v_stores_count + v_master_count,
        'merge_session_complete', 1
      ),
      'sample_entries', jsonb_build_array(
        jsonb_build_object(
          'change_type','merge_winner_selection',
          'entity_type','stores',
          'entity_id', v_winner_id,
          'related_entity_id', NULL,
          'before_data', jsonb_build_object('candidates', to_jsonb(v_store_ids)),
          'after_data', jsonb_build_object('winner', v_winner_id),
          'notes', format('Selected winner for group %s', p_group_id)
        ),
        jsonb_build_object(
          'change_type','merge_fk_repoint',
          'entity_type', COALESCE(v_fk_results->0->>'table_name','(none)'),
          'entity_id', NULL,
          'related_entity_id', v_winner_id,
          'before_data', jsonb_build_object('store_id_in', to_jsonb(v_loser_ids)),
          'after_data', jsonb_build_object('store_id', v_winner_id, 'rows', v_fk_results->0->'rows_to_repoint'),
          'notes', format('Re-point FK rows from losers to winner on table %s', COALESCE(v_fk_results->0->>'table_name','(none)'))
        ),
        jsonb_build_object(
          'change_type','merge_soft_delete',
          'entity_type','stores+store_master',
          'entity_id', NULL,
          'related_entity_id', v_winner_id,
          'before_data', jsonb_build_object('deleted_at', NULL),
          'after_data', jsonb_build_object('deleted_at', 'NOW()'),
          'notes', format('Soft-delete %s loser rows across both tables', v_stores_count + v_master_count)
        )
      )
    ),
    'warnings', v_warnings,
    'preview_generated_at', now()
  );
END;
$function$;