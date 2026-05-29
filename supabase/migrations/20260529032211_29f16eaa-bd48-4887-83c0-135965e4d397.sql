
-- ============================================================
-- MIGRATION 2: Store-merge engine — invoice repoint bypass,
--              survivor rename, and direct entrypoint
-- ============================================================
-- Architecture: one shared internal _execute_store_merge_from_plan()
-- + two preview functions (group-based, direct) + two thin execute wrappers.
-- Group-merge behavior is unchanged (relocated but bit-identical).
-- ============================================================

-- ------------------------------------------------------------
-- 1) SHARED INTERNAL: _execute_store_merge_from_plan
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._execute_store_merge_from_plan(
  p_plan jsonb,
  p_session_label text,
  p_group_id integer DEFAULT NULL,
  p_survivor_name_override text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id uuid := gen_random_uuid();
  v_started_at timestamptz := now();
  v_phase text := 'init';
  v_winner_id uuid;
  v_loser_ids uuid[];
  v_loser_id uuid;
  v_normalized_address text;
  v_contacts_to_create jsonb;
  v_consolidation jsonb;
  v_fk_results jsonb;
  v_phase_e_loser_ids jsonb;
  v_contacts_created int := 0;
  v_contacts_skipped int := 0;
  v_fields_consolidated int := 0;
  v_total_repoint bigint := 0;
  v_total_dedup_skip bigint := 0;
  v_soft_deletes int := 0;
  v_change_log_count int := 0;
  v_entry jsonb;
  v_field_entry jsonb;
  v_fk_entry jsonb;
  v_table text;
  v_col text;
  v_skip_reason text;
  v_repointed bigint;
  v_loser_skipped bigint;
  v_repointed_row_ids jsonb := '[]'::jsonb;
  v_new_contact_id uuid;
  v_existing_contact_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_phase_a_done timestamptz;
  v_phase_b_done timestamptz;
  v_phase_c_done timestamptz;
  v_phase_d_done timestamptz;
  v_phase_e_done timestamptz;
  v_skipped_rec record;
  v_generic_rec record;
  v_winner_old_name text;
  v_survivor_renamed boolean := false;
  v_invoice_snapshot_count int := 0;
  v_total_invoice_snapshots int := 0;
BEGIN
  v_winner_id          := (p_plan -> 'merge_summary' ->> 'winner_store_id')::uuid;
  v_normalized_address := p_plan ->> 'normalized_address';
  v_contacts_to_create := COALESCE(p_plan -> 'contacts_to_create','[]'::jsonb);
  v_consolidation      := COALESCE(p_plan -> 'field_consolidation','[]'::jsonb);
  v_fk_results         := COALESCE(p_plan -> 'phase_d_fk_repoints','[]'::jsonb);
  v_phase_e_loser_ids  := COALESCE(p_plan -> 'phase_e_soft_deletes' -> 'loser_ids','[]'::jsonb);
  v_loser_ids := ARRAY(SELECT jsonb_array_elements_text(v_phase_e_loser_ids)::uuid);

  -- HARD ASSERT (FIX-001k): winner must be in candidate pool
  DECLARE v_candidate_ids uuid[];
  BEGIN
    v_candidate_ids := ARRAY(SELECT (jsonb_array_elements_text(p_plan->'all_store_ids'))::uuid);
    IF NOT (v_winner_id = ANY(v_candidate_ids)) THEN
      RAISE EXCEPTION '_execute_store_merge_from_plan: winner % not in candidate pool % (FIX-001k assertion)',
        v_winner_id, v_candidate_ids USING ERRCODE = 'check_violation';
    END IF;
  END;

  -- PHASE A
  v_phase := 'phase_a_winner_selection';
  INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
  VALUES ('merge_winner_selected','stores',v_winner_id,
    jsonb_build_object('candidate_store_ids',p_plan->'all_store_ids','group_id',p_group_id,'normalized_address',v_normalized_address),
    jsonb_build_object('selected_winner',v_winner_id,'reason','plan_provided','is_override',p_plan->'winner'->'is_override'),
    'Phase A: winner identified', p_session_label, v_session_id, p_group_id);
  v_change_log_count := v_change_log_count+1;
  v_phase_a_done := clock_timestamp();

  -- PHASE B
  v_phase := 'phase_b_contacts';
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_contacts_to_create) LOOP
    IF COALESCE((v_entry->>'would_be_skipped')::boolean,false) THEN
      v_contacts_skipped := v_contacts_skipped+1;
      v_existing_contact_id := NULL;
      IF v_entry->>'skip_reason' = 'duplicate_contact_already_on_winner' THEN
        SELECT sc.id INTO v_existing_contact_id FROM store_contacts sc
        WHERE sc.store_id=v_winner_id
          AND lower(COALESCE(TRIM(sc.name),''))=lower(COALESCE(TRIM(v_entry->>'name'),''))
          AND COALESCE(regexp_replace(COALESCE(sc.phone,''),'\D','','g'),'')=COALESCE(regexp_replace(COALESCE(v_entry->>'phone',''),'\D','','g'),'')
        LIMIT 1;
      END IF;
      INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
      VALUES ('merge_contact_skipped','store_contacts',NULL,
        jsonb_build_object('skip_reason',v_entry->>'skip_reason','attempted_data',v_entry),
        jsonb_build_object('merged_with_existing_contact_id',v_existing_contact_id,'merged_with_loser_ids',v_entry->'merged_with_loser_ids'),
        'Phase B: contact skipped ('||COALESCE(v_entry->>'skip_reason','unknown')||')',
        p_session_label, v_session_id, p_group_id);
      v_change_log_count := v_change_log_count+1;
    ELSE
      INSERT INTO store_contacts (store_id,name,phone,email,source,original_store_id,created_via_session,notes)
      VALUES (v_winner_id,
        COALESCE(NULLIF(TRIM(v_entry->>'name'),''),'(unknown)'),
        NULLIF(v_entry->>'phone',''),
        NULLIF(v_entry->>'email',''),
        'merge_from_duplicate',
        (v_entry->>'from_loser_id')::uuid,
        v_session_id,
        format('Merged from %s loser store(s) via session %s',
               jsonb_array_length(COALESCE(v_entry->'merged_from_loser_ids','[]'::jsonb)), p_session_label))
      RETURNING id INTO v_new_contact_id;
      v_contacts_created := v_contacts_created+1;
      INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
      VALUES ('merge_contact_created','store_contacts',v_new_contact_id,NULL,
        jsonb_build_object('store_id',v_winner_id,'name',v_entry->>'name','phone',v_entry->>'phone','email',v_entry->>'email',
                           'source','merge_from_duplicate','original_store_id',v_entry->>'from_loser_id',
                           'merged_from_loser_ids',v_entry->'merged_from_loser_ids'),
        'Phase B: contact created on winner from loser data',
        p_session_label, v_session_id, p_group_id);
      v_change_log_count := v_change_log_count+1;
    END IF;
  END LOOP;
  v_phase_b_done := clock_timestamp();

  -- PHASE C
  v_phase := 'phase_c_field_consolidation';
  FOR v_field_entry IN SELECT * FROM jsonb_array_elements(v_consolidation) LOOP
    EXECUTE format('UPDATE %I SET %I=$1 WHERE id=$2 AND (%I IS NULL OR TRIM(%I::text)='''')',
      v_field_entry->>'target_table', v_field_entry->>'target_column',
      v_field_entry->>'target_column', v_field_entry->>'target_column')
      USING v_field_entry->>'planned_value', v_winner_id;
    v_fields_consolidated := v_fields_consolidated+1;
    INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
    VALUES ('merge_field_consolidated', v_field_entry->>'target_table', v_winner_id,
      jsonb_build_object('field',v_field_entry->>'field','target_table',v_field_entry->>'target_table','target_column',v_field_entry->>'target_column','previous_value',NULL),
      jsonb_build_object('field',v_field_entry->>'field','new_value',v_field_entry->>'planned_value','source_loser_id',v_field_entry->>'source_loser_id','source_updated_at',v_field_entry->>'source_updated_at'),
      'Phase C: field consolidated from loser', p_session_label, v_session_id, p_group_id);
    v_change_log_count := v_change_log_count+1;
  END LOOP;
  v_phase_c_done := clock_timestamp();

  -- PHASE D
  v_phase := 'phase_d_fk_repoint';
  FOR v_fk_entry IN SELECT * FROM jsonb_array_elements(v_fk_results) LOOP
    v_table       := v_fk_entry->>'table_name';
    v_col         := v_fk_entry->>'referencing_column';
    v_skip_reason := v_fk_entry->>'skip_reason';
    v_repointed   := 0;
    v_loser_skipped := 0;
    v_repointed_row_ids := '[]'::jsonb;

    IF v_table='store_notes' AND v_col='store_id' THEN
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data,
               (SELECT w.id FROM store_notes w WHERE w.store_id=v_winner_id
                  AND lower(regexp_replace(COALESCE(w.note_text,''),'\s+',' ','g'))=
                      lower(regexp_replace(COALESCE(l.note_text,''),'\s+',' ','g')) LIMIT 1) AS winner_match_id
        FROM store_notes l
        WHERE l.store_id=ANY(v_loser_ids)
          AND EXISTS (SELECT 1 FROM store_notes w WHERE w.store_id=v_winner_id
            AND lower(regexp_replace(COALESCE(w.note_text,''),'\s+',' ','g'))=
                lower(regexp_replace(COALESCE(l.note_text,''),'\s+',' ','g')))
      LOOP
        INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
        VALUES ('merge_dedup_skipped','store_notes',v_skipped_rec.row_id,v_skipped_rec.row_data,
          jsonb_build_object('skip_reason',v_skip_reason,'winner_match_id',v_skipped_rec.winner_match_id),
          'Row preserved on loser (soft-deleted), winner has equivalent note',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count+1;
        v_loser_skipped := v_loser_skipped+1;
      END LOOP;
      WITH upd AS (UPDATE store_notes l SET store_id=v_winner_id
        WHERE l.store_id=ANY(v_loser_ids)
          AND NOT EXISTS (SELECT 1 FROM store_notes w WHERE w.store_id=v_winner_id
            AND lower(regexp_replace(COALESCE(w.note_text,''),'\s+',' ','g'))=
                lower(regexp_replace(COALESCE(l.note_text,''),'\s+',' ','g'))) RETURNING l.id)
      SELECT COUNT(*), COALESCE(jsonb_agg(id),'[]'::jsonb)
        INTO v_repointed, v_repointed_row_ids FROM upd;

    ELSIF v_table='invoices' AND v_col='store_id' THEN
      -- Dedup-skip logging (UNCHANGED)
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data,
               (SELECT w.id FROM invoices w WHERE w.store_id=v_winner_id AND w.invoice_number=l.invoice_number LIMIT 1) AS winner_match_id
        FROM invoices l
        WHERE l.store_id=ANY(v_loser_ids) AND l.invoice_number IS NOT NULL
          AND EXISTS (SELECT 1 FROM invoices w WHERE w.store_id=v_winner_id AND w.invoice_number=l.invoice_number)
      LOOP
        INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
        VALUES ('merge_dedup_skipped','invoices',v_skipped_rec.row_id,v_skipped_rec.row_data,
          jsonb_build_object('skip_reason',v_skip_reason,'winner_match_id',v_skipped_rec.winner_match_id),
          'Row preserved on loser (soft-deleted), winner has same invoice_number',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count+1;
        v_loser_skipped := v_loser_skipped+1;
      END LOOP;

      -- NEW: snapshot every invoice that will be repointed
      INSERT INTO merge_invoice_repoint_log
        (invoice_id, original_store_id, new_store_id, new_store_name,
         was_finalized, invoice_status, invoice_total,
         merge_session_id, duplicate_group_id, session_label)
      SELECT l.id, l.store_id, v_winner_id,
             COALESCE(p_survivor_name_override,
                      (SELECT name FROM stores WHERE id = v_winner_id)),
             (l.status = 'finalized'),
             l.status, l.total,
             v_session_id, p_group_id, p_session_label
      FROM invoices l
      WHERE l.store_id = ANY(v_loser_ids)
        AND NOT (l.invoice_number IS NOT NULL
                 AND EXISTS (SELECT 1 FROM invoices w
                              WHERE w.store_id=v_winner_id
                                AND w.invoice_number=l.invoice_number));
      GET DIAGNOSTICS v_invoice_snapshot_count = ROW_COUNT;
      v_total_invoice_snapshots := v_total_invoice_snapshots + v_invoice_snapshot_count;

      -- NEW: gated UPDATE (drafts + finalized in one atomic statement)
      PERFORM set_config('app.merge_in_progress', 'true', true);
      WITH upd AS (UPDATE invoices l SET store_id=v_winner_id
        WHERE l.store_id=ANY(v_loser_ids)
          AND NOT (l.invoice_number IS NOT NULL AND EXISTS (SELECT 1 FROM invoices w WHERE w.store_id=v_winner_id AND w.invoice_number=l.invoice_number))
        RETURNING l.id)
      SELECT COUNT(*), COALESCE(jsonb_agg(id),'[]'::jsonb)
        INTO v_repointed, v_repointed_row_ids FROM upd;
      PERFORM set_config('app.merge_in_progress', 'false', true);

      -- INVARIANT: snapshot count == repoint count
      IF v_invoice_snapshot_count <> v_repointed THEN
        RAISE EXCEPTION
          'merge_invoice_repoint_log mismatch: snapshot=%, repointed=% (aborting)',
          v_invoice_snapshot_count, v_repointed;
      END IF;

    ELSIF v_table='orders' AND v_col='store_id' THEN
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data
        FROM orders l
        WHERE l.store_id=ANY(v_loser_ids)
          AND ((l.short_code IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=v_winner_id AND w.short_code=l.short_code))
            OR (l.external_ref IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=v_winner_id AND w.external_ref=l.external_ref)))
      LOOP
        INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
        VALUES ('merge_dedup_skipped','orders',v_skipped_rec.row_id,v_skipped_rec.row_data,
          jsonb_build_object('skip_reason',v_skip_reason),
          'Row preserved on loser (soft-deleted), winner has same short_code/external_ref',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count+1;
        v_loser_skipped := v_loser_skipped+1;
      END LOOP;
      WITH upd AS (UPDATE orders l SET store_id=v_winner_id
        WHERE l.store_id=ANY(v_loser_ids)
          AND NOT ((l.short_code IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=v_winner_id AND w.short_code=l.short_code))
                OR (l.external_ref IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=v_winner_id AND w.external_ref=l.external_ref)))
        RETURNING l.id)
      SELECT COUNT(*), COALESCE(jsonb_agg(id),'[]'::jsonb)
        INTO v_repointed, v_repointed_row_ids FROM upd;

    ELSIF v_table='communication_events' AND v_col='store_id' THEN
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data
        FROM communication_events l
        WHERE l.store_id=ANY(v_loser_ids)
          AND EXISTS (SELECT 1 FROM communication_events w WHERE w.store_id=v_winner_id
            AND date_trunc('second',w.created_at)=date_trunc('second',l.created_at)
            AND w.channel IS NOT DISTINCT FROM l.channel
            AND w.event_type IS NOT DISTINCT FROM l.event_type)
      LOOP
        INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
        VALUES ('merge_dedup_skipped','communication_events',v_skipped_rec.row_id,v_skipped_rec.row_data,
          jsonb_build_object('skip_reason',v_skip_reason),
          'Row preserved on loser (soft-deleted), winner has equivalent comm event',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count+1;
        v_loser_skipped := v_loser_skipped+1;
      END LOOP;
      WITH upd AS (UPDATE communication_events l SET store_id=v_winner_id
        WHERE l.store_id=ANY(v_loser_ids)
          AND NOT EXISTS (SELECT 1 FROM communication_events w WHERE w.store_id=v_winner_id
            AND date_trunc('second',w.created_at)=date_trunc('second',l.created_at)
            AND w.channel IS NOT DISTINCT FROM l.channel
            AND w.event_type IS NOT DISTINCT FROM l.event_type)
        RETURNING l.id)
      SELECT COUNT(*), COALESCE(jsonb_agg(id),'[]'::jsonb)
        INTO v_repointed, v_repointed_row_ids FROM upd;

    ELSIF v_table='manual_call_logs' AND v_col='store_id' THEN
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data
        FROM manual_call_logs l
        WHERE l.store_id=ANY(v_loser_ids)
          AND EXISTS (SELECT 1 FROM manual_call_logs w WHERE w.store_id=v_winner_id
            AND date_trunc('second',w.created_at)=date_trunc('second',l.created_at)
            AND w.outcome IS NOT DISTINCT FROM l.outcome)
      LOOP
        INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
        VALUES ('merge_dedup_skipped','manual_call_logs',v_skipped_rec.row_id,v_skipped_rec.row_data,
          jsonb_build_object('skip_reason',v_skip_reason),
          'Row preserved on loser (soft-deleted), winner has equivalent call log',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count+1;
        v_loser_skipped := v_loser_skipped+1;
      END LOOP;
      WITH upd AS (UPDATE manual_call_logs l SET store_id=v_winner_id
        WHERE l.store_id=ANY(v_loser_ids)
          AND NOT EXISTS (SELECT 1 FROM manual_call_logs w WHERE w.store_id=v_winner_id
            AND date_trunc('second',w.created_at)=date_trunc('second',l.created_at)
            AND w.outcome IS NOT DISTINCT FROM l.outcome)
        RETURNING l.id)
      SELECT COUNT(*), COALESCE(jsonb_agg(id),'[]'::jsonb)
        INTO v_repointed, v_repointed_row_ids FROM upd;

    ELSE
      -- Generic: row-by-row with unique-violation tolerance
      FOR v_generic_rec IN
        EXECUTE format('SELECT to_jsonb(t) AS row_data, t.ctid AS rowctid FROM %I t WHERE %I = ANY($1)', v_table, v_col)
        USING v_loser_ids
      LOOP
        BEGIN
          EXECUTE format('UPDATE %I SET %I=$1 WHERE ctid=$2', v_table, v_col)
            USING v_winner_id, v_generic_rec.rowctid;
          v_repointed := v_repointed + 1;
          v_repointed_row_ids := v_repointed_row_ids
            || to_jsonb(COALESCE(v_generic_rec.row_data->>'id', v_generic_rec.rowctid::text));
        EXCEPTION WHEN unique_violation THEN
          INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
          VALUES ('merge_dedup_skipped',v_table,NULL,v_generic_rec.row_data,
            jsonb_build_object('skip_reason','unique_constraint_violation_on_repoint','detail', SQLERRM),
            'Row preserved on loser (soft-deleted), would have violated unique constraint on winner',
            p_session_label, v_session_id, p_group_id);
          v_change_log_count := v_change_log_count + 1;
          v_loser_skipped := v_loser_skipped + 1;
        END;
      END LOOP;
    END IF;

    v_total_repoint    := v_total_repoint + v_repointed;
    v_total_dedup_skip := v_total_dedup_skip + v_loser_skipped;

    INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
    VALUES ('merge_fk_repointed', v_table, v_winner_id,
      jsonb_build_object('loser_ids',to_jsonb(v_loser_ids),
                         'rows_to_repoint',v_fk_entry->'rows_to_repoint',
                         'rows_planned_skipped',v_fk_entry->'rows_to_skip_dedup'),
      jsonb_build_object('new_store_id',v_winner_id,
                         'rows_actually_repointed',v_repointed,
                         'skipped_due_to_dedup',v_loser_skipped,
                         'repointed_row_ids', COALESCE(v_repointed_row_ids,'[]'::jsonb)),
      format('Phase D: re-pointed %s row(s) in %s, skipped %s', v_repointed, v_table, v_loser_skipped),
      p_session_label, v_session_id, p_group_id);
    v_change_log_count := v_change_log_count + 1;
  END LOOP;
  v_phase_d_done := clock_timestamp();

  -- PHASE E (UNCHANGED)
  v_phase := 'phase_e_soft_delete';
  FOREACH v_loser_id IN ARRAY v_loser_ids LOOP
    SELECT to_jsonb(s) INTO v_before FROM stores s WHERE s.id=v_loser_id AND s.deleted_at IS NULL;
    IF v_before IS NOT NULL THEN
      UPDATE stores SET deleted_at=now(), deleted_reason='merged_into_winner_'||v_winner_id::text WHERE id=v_loser_id;
      v_soft_deletes := v_soft_deletes+1;
      INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,related_entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
      VALUES ('merge_soft_deleted_stores','stores',v_loser_id,v_winner_id,v_before,
        jsonb_build_object('deleted_at',now(),'merged_into',v_winner_id),
        'Phase E: stores row soft-deleted', p_session_label, v_session_id, p_group_id);
      v_change_log_count := v_change_log_count+1;
    END IF;

    SELECT to_jsonb(sm) INTO v_before FROM store_master sm WHERE sm.id=v_loser_id AND sm.deleted_at IS NULL;
    IF v_before IS NOT NULL THEN
      UPDATE store_master SET deleted_at=now(), deleted_reason='merged_into_winner_'||v_winner_id::text WHERE id=v_loser_id;
      v_soft_deletes := v_soft_deletes+1;
      INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,related_entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
      VALUES ('merge_soft_deleted_store_master','store_master',v_loser_id,v_winner_id,v_before,
        jsonb_build_object('deleted_at',now(),'merged_into',v_winner_id),
        'Phase E: store_master row soft-deleted', p_session_label, v_session_id, p_group_id);
      v_change_log_count := v_change_log_count+1;
    END IF;
  END LOOP;
  v_phase_e_done := clock_timestamp();

  -- NEW PHASE E.5: survivor rename
  v_phase := 'phase_e5_survivor_rename';
  IF p_survivor_name_override IS NOT NULL THEN
    SELECT name INTO v_winner_old_name FROM stores WHERE id = v_winner_id;
    UPDATE stores SET name = p_survivor_name_override WHERE id = v_winner_id;
    v_survivor_renamed := true;
    INSERT INTO dynasty_change_log
      (change_type, entity_type, entity_id, before_data, after_data, notes,
       session_label, session_id, duplicate_group_id)
    VALUES ('merge_survivor_renamed', 'stores', v_winner_id,
      jsonb_build_object('name', v_winner_old_name),
      jsonb_build_object('name', p_survivor_name_override),
      CASE
        WHEN p_survivor_name_override NOT LIKE '% - %'
          THEN 'Phase E.5: survivor renamed — BUSINESS NAME PENDING (address-only)'
        ELSE 'Phase E.5: survivor renamed to canonical "Address - Name" format'
      END,
      p_session_label, v_session_id, p_group_id);
    v_change_log_count := v_change_log_count + 1;
  END IF;

  -- PHASE F
  v_phase := 'phase_f_session_complete';
  v_after := jsonb_build_object(
    'session_id',v_session_id,'session_label',p_session_label,'group_id',p_group_id,
    'winner_store_id',v_winner_id,
    'losers_processed',COALESCE(array_length(v_loser_ids,1),0),
    'contacts_created',v_contacts_created,'contacts_skipped',v_contacts_skipped,
    'fields_consolidated',v_fields_consolidated,
    'fk_rows_repointed',v_total_repoint,'fk_rows_skipped_dedup',v_total_dedup_skip,
    'soft_deletes',v_soft_deletes,
    'survivor_renamed', v_survivor_renamed,
    'survivor_new_name', p_survivor_name_override,
    'invoice_snapshots_written', v_total_invoice_snapshots,
    'total_change_log_entries',v_change_log_count+1,
    'duration_seconds',EXTRACT(EPOCH FROM (now()-v_started_at)),
    'phase_a_completed_at',v_phase_a_done,'phase_b_completed_at',v_phase_b_done,
    'phase_c_completed_at',v_phase_c_done,'phase_d_completed_at',v_phase_d_done,
    'phase_e_completed_at',v_phase_e_done);
  INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
  VALUES ('merge_session_completed','merge_session',v_session_id,p_plan,v_after,
    format('Merge completed (group=%s). Losers soft-deleted and data preserved.', COALESCE(p_group_id::text,'DIRECT')),
    p_session_label, v_session_id, p_group_id);
  v_change_log_count := v_change_log_count+1;

  RETURN jsonb_build_object('success',true,'group_id',p_group_id,'session_id',v_session_id,
    'session_label',p_session_label,'winner_store_id',v_winner_id,
    'losers_processed',COALESCE(array_length(v_loser_ids,1),0),
    'contacts_created',v_contacts_created,'contacts_skipped',v_contacts_skipped,
    'fields_consolidated',v_fields_consolidated,
    'fk_rows_repointed',v_total_repoint,'fk_rows_skipped_dedup',v_total_dedup_skip,
    'soft_deletes',v_soft_deletes,
    'survivor_renamed', v_survivor_renamed,
    'survivor_new_name', p_survivor_name_override,
    'invoice_snapshots_written', v_total_invoice_snapshots,
    'change_log_entries_written',v_change_log_count,
    'duration_seconds',EXTRACT(EPOCH FROM (now()-v_started_at)),
    'started_at',v_started_at,'completed_at',now());

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$function$;

-- ------------------------------------------------------------
-- 2) REFACTOR execute_store_merge_group → thin wrapper
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.execute_store_merge_group(integer, text, boolean);

CREATE OR REPLACE FUNCTION public.execute_store_merge_group(
  p_group_id integer,
  p_session_label text,
  p_operator_acknowledged_review boolean DEFAULT false,
  p_survivor_name_override text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan jsonb;
  v_needs_review boolean;
BEGIN
  v_plan := preview_store_merge_group(p_group_id);
  IF v_plan ? 'error' THEN
    RETURN jsonb_build_object('aborted',true,'reason','preview_failed','group_id',p_group_id,'preview_error',v_plan);
  END IF;

  v_needs_review := COALESCE((v_plan -> 'merge_summary' ->> 'requires_operator_approval')::boolean,false);
  IF v_needs_review AND NOT p_operator_acknowledged_review THEN
    RETURN jsonb_build_object('aborted',true,'reason','needs_review_unacknowledged','group_id',p_group_id,
      'review_reasons', v_plan -> 'review_reasons',
      'message','This group requires operator review. Pass p_operator_acknowledged_review=true to proceed.');
  END IF;

  IF EXISTS(SELECT 1 FROM dynasty_merge_skiplist WHERE duplicate_group_id=p_group_id) THEN
    RETURN jsonb_build_object('aborted',true,'reason','skiplisted','group_id',p_group_id);
  END IF;

  RETURN _execute_store_merge_from_plan(v_plan, p_session_label, p_group_id, p_survivor_name_override);
END;
$$;

-- ------------------------------------------------------------
-- 3) NEW: preview_store_merge_direct
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_store_merge_direct(
  p_winner_id uuid,
  p_loser_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_normalized_address text;
  v_store_ids uuid[];
  v_winner_id uuid := p_winner_id;
  v_winner_record jsonb;
  v_losers jsonb := '[]'::jsonb;
  v_consolidation jsonb := '[]'::jsonb;
  v_contacts_to_create jsonb := '[]'::jsonb;
  v_loser_ids uuid[] := p_loser_ids;
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
  v_stores_count int := 0;
  v_master_count int := 0;
  v_match_idx int;
  v_match_entry jsonb;
  v_existing jsonb;
  v_idx int;
BEGIN
  v_store_ids := p_winner_id || p_loser_ids;

  -- Derive normalized_address from winner's store_master (lowercased trimmed)
  SELECT lower(TRIM(COALESCE(sm.address,'') || ' ' || COALESCE(sm.city,'') || ' ' || COALESCE(sm.state,'') || ' ' || COALESCE(sm.zip,'')))
    INTO v_normalized_address
    FROM store_master sm WHERE sm.id = v_winner_id;
  v_normalized_address := COALESCE(v_normalized_address, '');

  -- Winner identity
  SELECT
    COALESCE(NULLIF(TRIM(sm.store_name),''), NULLIF(TRIM(s.name),'')),
    COALESCE(NULLIF(TRIM(s.phone),''), NULLIF(TRIM(sm.phone),''))
  INTO v_winner_eff_name, v_winner_eff_phone
  FROM (SELECT v_winner_id AS id) k
  LEFT JOIN stores s ON s.id=k.id
  LEFT JOIN store_master sm ON sm.id=k.id;

  v_winner_norm_name  := lower(COALESCE(TRIM(v_winner_eff_name),''));
  v_winner_norm_phone := COALESCE(regexp_replace(COALESCE(v_winner_eff_phone,''),'\D','','g'),'');

  SELECT jsonb_build_object(
    'store_id', v_winner_id,
    'effective_name', v_winner_eff_name,
    'effective_phone', v_winner_eff_phone,
    'effective_email', COALESCE(NULLIF(TRIM(s.email),''), NULLIF(TRIM(sm.email),'')),
    'stores_exists', s.id IS NOT NULL,
    'store_master_exists', sm.id IS NOT NULL,
    'created_at', LEAST(s.created_at, sm.created_at),
    'is_override', true
  ) INTO v_winner_record
  FROM (SELECT v_winner_id AS id) k
  LEFT JOIN stores s ON s.id=k.id
  LEFT JOIN store_master sm ON sm.id=k.id;

  -- Loser loop with intra-batch dedup (identical logic to preview_store_merge_group)
  FOREACH v_loser_id IN ARRAY v_loser_ids LOOP
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

    v_loser_data := jsonb_build_object(
      'store_id', v_loser_id,
      'effective_name', v_loser_eff_name,
      'effective_phone', v_loser_eff_phone,
      'effective_email', v_loser_eff_email,
      'normalized_name', v_loser_norm_name,
      'normalized_phone', v_loser_norm_phone,
      'classification', CASE WHEN v_is_typo THEN 'typo_duplicate' ELSE 'real_person_contact' END
    );
    v_losers := v_losers || v_loser_data;

    IF NOT v_is_typo THEN
      v_match_idx := NULL; v_idx := 0;
      FOR v_existing IN SELECT * FROM jsonb_array_elements(v_contacts_to_create) LOOP
        IF (v_existing->>'would_be_skipped')::boolean IS NOT TRUE
           AND lower(COALESCE(TRIM(v_existing->>'name'),'')) = v_loser_norm_name
           AND COALESCE(v_existing->>'phone','') = COALESCE(NULLIF(v_loser_norm_phone,''),'')
        THEN v_match_idx := v_idx; v_match_entry := v_existing; EXIT; END IF;
        v_idx := v_idx + 1;
      END LOOP;

      IF v_match_idx IS NOT NULL THEN
        v_contacts_to_create := v_contacts_to_create || jsonb_build_object(
          'from_loser_id', v_loser_id, 'name', v_loser_eff_name,
          'phone', NULLIF(v_loser_norm_phone,''), 'email', v_loser_eff_email,
          'would_be_skipped', true,
          'skip_reason', 'intra-batch duplicate — already creating contact with this name+phone from earlier loser',
          'merged_with_loser_ids', jsonb_build_array(v_match_entry->>'from_loser_id'),
          'merged_from_loser_ids', '[]'::jsonb);
        v_contacts_to_create := jsonb_set(
          v_contacts_to_create,
          ARRAY[v_match_idx::text, 'merged_from_loser_ids'],
          COALESCE(v_match_entry->'merged_from_loser_ids','[]'::jsonb) || to_jsonb(v_loser_id::text));
      ELSE
        SELECT EXISTS (SELECT 1 FROM store_contacts sc
          WHERE sc.store_id = v_winner_id
            AND lower(COALESCE(TRIM(sc.name),'')) = v_loser_norm_name
            AND COALESCE(regexp_replace(COALESCE(sc.phone,''),'\D','','g'),'') = v_loser_norm_phone)
        INTO v_existing_contact;
        v_contacts_to_create := v_contacts_to_create || jsonb_build_object(
          'from_loser_id', v_loser_id, 'name', v_loser_eff_name,
          'phone', NULLIF(v_loser_norm_phone,''), 'email', v_loser_eff_email,
          'would_be_skipped', v_existing_contact,
          'skip_reason', CASE WHEN v_existing_contact THEN 'duplicate_contact_already_on_winner' ELSE NULL END,
          'merged_from_loser_ids', jsonb_build_array(v_loser_id::text));
      END IF;
    END IF;
  END LOOP;

  -- Phase C field consolidation plan (identical)
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
        'source_updated_at', v_best_loser_updated);
    END IF;
  END LOOP;

  -- Phase D FK plan (identical logic)
  IF array_length(v_loser_ids,1) > 0 THEN
    FOR v_fk IN
      SELECT n.nspname AS ref_schema, cl.relname AS ref_table, a.attname AS ref_column,
             c.confrelid::regclass::text AS target_table
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype='f'
        AND c.confrelid::regclass::text IN ('stores','store_master','public.stores','public.store_master')
        AND n.nspname='public'
    LOOP
      v_rows_total := 0; v_rows_dedup := 0; v_sample_skipped := '[]'::jsonb; v_dedup_rule := NULL;
      BEGIN
        EXECUTE format('SELECT COUNT(*) FROM %I.%I WHERE %I = ANY($1)',
          v_fk.ref_schema, v_fk.ref_table, v_fk.ref_column) INTO v_rows_total USING v_loser_ids;
      EXCEPTION WHEN OTHERS THEN v_rows_total := 0;
      END;
      IF v_rows_total = 0 THEN CONTINUE; END IF;

      IF v_fk.ref_table = 'store_notes' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'normalized note_text matches existing on winner';
        EXECUTE $$SELECT COUNT(*) FROM store_notes l
          WHERE l.store_id = ANY($1)
            AND EXISTS (SELECT 1 FROM store_notes w WHERE w.store_id = $2
              AND lower(regexp_replace(COALESCE(w.note_text,''),'\s+',' ','g')) =
                  lower(regexp_replace(COALESCE(l.note_text,''),'\s+',' ','g')))$$
        INTO v_rows_dedup USING v_loser_ids, v_winner_id;
      ELSIF v_fk.ref_table = 'invoices' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'duplicate invoice_number on winner';
        EXECUTE $$SELECT COUNT(*) FROM invoices l
          WHERE l.store_id = ANY($1) AND l.invoice_number IS NOT NULL
            AND EXISTS (SELECT 1 FROM invoices w WHERE w.store_id=$2 AND w.invoice_number = l.invoice_number)$$
        INTO v_rows_dedup USING v_loser_ids, v_winner_id;
      ELSIF v_fk.ref_table = 'orders' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'duplicate short_code or external_ref on winner';
        EXECUTE $$SELECT COUNT(*) FROM orders l WHERE l.store_id = ANY($1)
            AND ((l.short_code IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=$2 AND w.short_code=l.short_code))
              OR (l.external_ref IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=$2 AND w.external_ref=l.external_ref)))$$
        INTO v_rows_dedup USING v_loser_ids, v_winner_id;
      ELSIF v_fk.ref_table = 'communication_events' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'same created_at(sec) + channel + event_type on winner';
        EXECUTE $$SELECT COUNT(*) FROM communication_events l WHERE l.store_id = ANY($1)
            AND EXISTS (SELECT 1 FROM communication_events w WHERE w.store_id=$2
              AND date_trunc('second', w.created_at) = date_trunc('second', l.created_at)
              AND w.channel IS NOT DISTINCT FROM l.channel
              AND w.event_type IS NOT DISTINCT FROM l.event_type)$$
        INTO v_rows_dedup USING v_loser_ids, v_winner_id;
      ELSIF v_fk.ref_table = 'manual_call_logs' AND v_fk.ref_column='store_id' THEN
        v_dedup_rule := 'same created_at(sec) + outcome on winner';
        EXECUTE $$SELECT COUNT(*) FROM manual_call_logs l WHERE l.store_id = ANY($1)
            AND EXISTS (SELECT 1 FROM manual_call_logs w WHERE w.store_id=$2
              AND date_trunc('second', w.created_at) = date_trunc('second', l.created_at)
              AND w.outcome IS NOT DISTINCT FROM l.outcome)$$
        INTO v_rows_dedup USING v_loser_ids, v_winner_id;
      END IF;

      v_rows_repoint := v_rows_total - COALESCE(v_rows_dedup,0);
      v_total_repoint := v_total_repoint + v_rows_repoint;
      v_total_dedup_skip := v_total_dedup_skip + COALESCE(v_rows_dedup,0);
      v_tables_affected := v_tables_affected + 1;
      IF COALESCE(v_rows_dedup,0) > 0 THEN v_tables_with_dedup := v_tables_with_dedup + 1; END IF;

      v_fk_results := v_fk_results || jsonb_build_object(
        'table_name', v_fk.ref_table,
        'referencing_column', v_fk.ref_column,
        'target_table', v_fk.target_table,
        'rows_total', v_rows_total,
        'rows_to_repoint', v_rows_repoint,
        'rows_to_skip_dedup', COALESCE(v_rows_dedup,0),
        'skip_reason', v_dedup_rule,
        'is_money_table', v_fk.ref_table IN ('store_payments','store_transactions','store_wallet','commission_ledger','invoices'));
    END LOOP;
  END IF;

  v_fk_results := COALESCE((
    SELECT jsonb_agg(elem ORDER BY (elem->>'rows_to_repoint')::bigint DESC)
    FROM jsonb_array_elements(v_fk_results) elem), '[]'::jsonb);

  -- Phase E enumeration
  IF array_length(v_loser_ids,1) > 0 THEN
    SELECT COUNT(*) INTO v_stores_count FROM stores WHERE id = ANY(v_loser_ids) AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_master_count FROM store_master WHERE id = ANY(v_loser_ids) AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'merge_summary', jsonb_build_object(
      'group_id', NULL,
      'normalized_address', v_normalized_address,
      'winner_store_id', v_winner_id,
      'winner_name', v_winner_eff_name,
      'loser_count', COALESCE(array_length(v_loser_ids,1),0),
      'tables_to_repoint', v_tables_affected,
      'rows_to_repoint', v_total_repoint,
      'rows_to_skip_dedup', v_total_dedup_skip,
      'soft_deletes_total', v_stores_count + v_master_count,
      'requires_operator_approval', false,
      'mode', 'direct'),
    'group_id', NULL,
    'normalized_address', v_normalized_address,
    'group_size', array_length(v_store_ids,1),
    'all_store_ids', to_jsonb(v_store_ids),
    'winner', v_winner_record,
    'losers', v_losers,
    'contacts_to_create', v_contacts_to_create,
    'field_consolidation', v_consolidation,
    'phase_d_fk_repoints', v_fk_results,
    'phase_e_soft_deletes', jsonb_build_object(
      'loser_ids', to_jsonb(v_loser_ids),
      'stores_table_count', v_stores_count,
      'store_master_table_count', v_master_count,
      'total', v_stores_count + v_master_count),
    'mode', 'direct');
END;
$function$;

-- ------------------------------------------------------------
-- 4) NEW: execute_store_merge_direct
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_store_merge_direct(
  p_winner_id uuid,
  p_loser_ids uuid[],
  p_session_label text,
  p_survivor_name_override text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan jsonb;
  v_bad_count int;
BEGIN
  IF p_winner_id IS NULL OR p_loser_ids IS NULL OR array_length(p_loser_ids,1) = 0 THEN
    RAISE EXCEPTION 'execute_store_merge_direct: winner and at least one loser required';
  END IF;
  IF p_winner_id = ANY(p_loser_ids) THEN
    RAISE EXCEPTION 'execute_store_merge_direct: winner % cannot also be a loser', p_winner_id;
  END IF;
  PERFORM 1 FROM stores WHERE id = p_winner_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'execute_store_merge_direct: winner % missing or soft-deleted', p_winner_id;
  END IF;
  SELECT COUNT(*) INTO v_bad_count
    FROM unnest(p_loser_ids) u(id)
    LEFT JOIN stores s ON s.id = u.id AND s.deleted_at IS NULL
    WHERE s.id IS NULL;
  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'execute_store_merge_direct: % loser(s) missing or already soft-deleted', v_bad_count;
  END IF;

  v_plan := preview_store_merge_direct(p_winner_id, p_loser_ids);
  IF v_plan ? 'error' THEN
    RETURN jsonb_build_object('aborted',true,'reason','preview_failed','preview_error',v_plan);
  END IF;

  RETURN _execute_store_merge_from_plan(v_plan, p_session_label, NULL, p_survivor_name_override);
END;
$$;
