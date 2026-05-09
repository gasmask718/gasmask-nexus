CREATE OR REPLACE FUNCTION public.execute_store_merge_group(p_group_id integer, p_session_label text, p_operator_acknowledged_review boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id uuid := gen_random_uuid();
  v_started_at timestamptz := now();
  v_phase text := 'init';

  v_plan jsonb;
  v_needs_review boolean;
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
  v_repointed_row_ids jsonb := '[]'::jsonb;  -- FIX-001j.ROWLOG
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
  v_one_count bigint;
BEGIN
  v_phase := 'planning';
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

  v_winner_id          := (v_plan -> 'merge_summary' ->> 'winner_store_id')::uuid;
  v_normalized_address := v_plan ->> 'normalized_address';
  v_contacts_to_create := COALESCE(v_plan -> 'contacts_to_create','[]'::jsonb);
  v_consolidation      := COALESCE(v_plan -> 'field_consolidation','[]'::jsonb);
  v_fk_results         := COALESCE(v_plan -> 'phase_d_fk_repoints','[]'::jsonb);
  v_phase_e_loser_ids  := COALESCE(v_plan -> 'phase_e_soft_deletes' -> 'loser_ids','[]'::jsonb);
  v_loser_ids := ARRAY(SELECT jsonb_array_elements_text(v_phase_e_loser_ids)::uuid);

  -- FIX-001k: HARD ASSERT — defense-in-depth before any write
  DECLARE
    v_candidate_ids uuid[];
  BEGIN
    v_candidate_ids := ARRAY(SELECT (jsonb_array_elements_text(v_plan->'all_store_ids'))::uuid);
    IF NOT (v_winner_id = ANY(v_candidate_ids)) THEN
      RAISE EXCEPTION
        'execute_store_merge_group: winner % not in candidate pool % for group % (FIX-001k assertion)',
        v_winner_id, v_candidate_ids, p_group_id
        USING ERRCODE = 'check_violation';
    END IF;
  END;

  -- PHASE A
  v_phase := 'phase_a_winner_selection';
  INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
  VALUES ('merge_winner_selected','stores',v_winner_id,
    jsonb_build_object('candidate_store_ids',v_plan->'all_store_ids','group_id',p_group_id,'normalized_address',v_normalized_address),
    jsonb_build_object('selected_winner',v_winner_id,'reason','highest_score_oldest_tiebreaker','is_override',v_plan->'winner'->'is_override'),
    'Phase A: winner identified for group '||p_group_id, p_session_label, v_session_id, p_group_id);
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
    v_repointed_row_ids := '[]'::jsonb;  -- FIX-001j.ROWLOG: reset per FK table

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
      WITH upd AS (UPDATE invoices l SET store_id=v_winner_id
        WHERE l.store_id=ANY(v_loser_ids)
          AND NOT (l.invoice_number IS NOT NULL AND EXISTS (SELECT 1 FROM invoices w WHERE w.store_id=v_winner_id AND w.invoice_number=l.invoice_number))
        RETURNING l.id)
      SELECT COUNT(*), COALESCE(jsonb_agg(id),'[]'::jsonb)
        INTO v_repointed, v_repointed_row_ids FROM upd;

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
          -- FIX-001j.ROWLOG: capture row id where available, fall back to ctid
          v_repointed_row_ids := v_repointed_row_ids
            || to_jsonb(COALESCE(v_generic_rec.row_data->>'id', v_generic_rec.rowctid::text));
        EXCEPTION WHEN unique_violation THEN
          INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
          VALUES ('merge_dedup_skipped',v_table,NULL,v_generic_rec.row_data,
            jsonb_build_object('skip_reason','unique_constraint_violation_on_repoint',
                               'detail', SQLERRM),
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
                         'repointed_row_ids', COALESCE(v_repointed_row_ids,'[]'::jsonb)),  -- FIX-001j.ROWLOG
      format('Phase D: re-pointed %s row(s) in %s, skipped %s', v_repointed, v_table, v_loser_skipped),
      p_session_label, v_session_id, p_group_id);
    v_change_log_count := v_change_log_count + 1;
  END LOOP;
  v_phase_d_done := clock_timestamp();

  -- PHASE E
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
    'total_change_log_entries',v_change_log_count+1,
    'duration_seconds',EXTRACT(EPOCH FROM (now()-v_started_at)),
    'phase_a_completed_at',v_phase_a_done,'phase_b_completed_at',v_phase_b_done,
    'phase_c_completed_at',v_phase_c_done,'phase_d_completed_at',v_phase_d_done,
    'phase_e_completed_at',v_phase_e_done);
  INSERT INTO dynasty_change_log (change_type,entity_type,entity_id,before_data,after_data,notes,session_label,session_id,duplicate_group_id)
  VALUES ('merge_session_completed','merge_session',v_session_id,v_plan,v_after,
    format('Merge of group %s completed. Losers soft-deleted and data preserved.', p_group_id),
    p_session_label, v_session_id, p_group_id);
  v_change_log_count := v_change_log_count+1;

  RETURN jsonb_build_object('success',true,'group_id',p_group_id,'session_id',v_session_id,
    'session_label',p_session_label,'winner_store_id',v_winner_id,
    'losers_processed',COALESCE(array_length(v_loser_ids,1),0),
    'contacts_created',v_contacts_created,'contacts_skipped',v_contacts_skipped,
    'fields_consolidated',v_fields_consolidated,
    'fk_rows_repointed',v_total_repoint,'fk_rows_skipped_dedup',v_total_dedup_skip,
    'soft_deletes',v_soft_deletes,'change_log_entries_written',v_change_log_count,
    'duration_seconds',EXTRACT(EPOCH FROM (now()-v_started_at)),
    'started_at',v_started_at,'completed_at',now());

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Merge execution failed in phase % for group %: %. Transaction rolled back, no data modified.',
    v_phase, p_group_id, SQLERRM USING DETAIL = format('session_id=%s', v_session_id);
END;
$function$;