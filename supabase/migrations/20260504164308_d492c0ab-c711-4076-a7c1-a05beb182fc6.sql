
-- ============================================================
-- 1. Schema additions
-- ============================================================
ALTER TABLE public.dynasty_change_log
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS duplicate_group_id integer;

CREATE INDEX IF NOT EXISTS idx_dynasty_change_log_session_id
  ON public.dynasty_change_log(session_id);

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.store_contacts
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS original_store_id uuid,
  ADD COLUMN IF NOT EXISTS created_via_session uuid;

CREATE INDEX IF NOT EXISTS idx_store_contacts_created_via_session
  ON public.store_contacts(created_via_session);

-- ============================================================
-- 2. execute_store_merge_group
-- ============================================================
CREATE OR REPLACE FUNCTION public.execute_store_merge_group(
  p_group_id integer,
  p_session_label text,
  p_operator_acknowledged_review boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_winner_norm_name text;
  v_winner_norm_phone text;

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
  v_skip_reason text;
  v_repointed bigint;
  v_loser_skipped bigint;
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
BEGIN
  -- ============================================================
  -- GUARD 1+2: Plan via preview
  -- ============================================================
  v_phase := 'planning';
  v_plan := preview_store_merge_group(p_group_id);

  IF v_plan ? 'error' THEN
    RETURN jsonb_build_object('aborted', true, 'reason','preview_failed',
      'group_id', p_group_id, 'preview_error', v_plan);
  END IF;

  v_needs_review := COALESCE((v_plan -> 'merge_summary' ->> 'requires_operator_approval')::boolean, false);
  IF v_needs_review AND NOT p_operator_acknowledged_review THEN
    RETURN jsonb_build_object('aborted', true, 'reason','needs_review_unacknowledged',
      'group_id', p_group_id,
      'review_reasons', v_plan -> 'review_reasons',
      'message','This group requires operator review. Pass p_operator_acknowledged_review=true to proceed.');
  END IF;

  -- GUARD 3: Skiplist
  IF EXISTS(SELECT 1 FROM dynasty_merge_skiplist WHERE duplicate_group_id = p_group_id) THEN
    RETURN jsonb_build_object('aborted', true, 'reason','skiplisted',
      'group_id', p_group_id,
      'message','This group is in dynasty_merge_skiplist.');
  END IF;

  -- Extract plan elements
  v_winner_id          := (v_plan -> 'merge_summary' ->> 'winner_store_id')::uuid;
  v_normalized_address := v_plan ->> 'normalized_address';
  v_contacts_to_create := COALESCE(v_plan -> 'contacts_to_create', '[]'::jsonb);
  v_consolidation      := COALESCE(v_plan -> 'field_consolidation', '[]'::jsonb);
  v_fk_results         := COALESCE(v_plan -> 'phase_d_fk_repoints', '[]'::jsonb);
  v_phase_e_loser_ids  := COALESCE(v_plan -> 'phase_e_soft_deletes' -> 'loser_ids', '[]'::jsonb);

  v_loser_ids := ARRAY(SELECT jsonb_array_elements_text(v_phase_e_loser_ids)::uuid);

  -- Compute winner identity for typo detection
  SELECT lower(COALESCE(TRIM(COALESCE(NULLIF(TRIM(sm.store_name),''), NULLIF(TRIM(s.name),''))),'')),
         COALESCE(regexp_replace(COALESCE(COALESCE(NULLIF(TRIM(s.phone),''), NULLIF(TRIM(sm.phone),'')),''),'\D','','g'),'')
  INTO v_winner_norm_name, v_winner_norm_phone
  FROM (SELECT v_winner_id AS id) k
  LEFT JOIN stores s ON s.id=k.id
  LEFT JOIN store_master sm ON sm.id=k.id;

  -- ============================================================
  -- PHASE A: Winner selection log
  -- ============================================================
  v_phase := 'phase_a_winner_selection';
  INSERT INTO dynasty_change_log
    (change_type, entity_type, entity_id, before_data, after_data,
     notes, session_label, session_id, duplicate_group_id)
  VALUES (
    'merge_winner_selected', 'stores', v_winner_id,
    jsonb_build_object('candidate_store_ids', v_plan -> 'all_store_ids',
                       'group_id', p_group_id,
                       'normalized_address', v_normalized_address),
    jsonb_build_object('selected_winner', v_winner_id,
                       'reason','highest_score_oldest_tiebreaker',
                       'is_override', v_plan -> 'winner' -> 'is_override'),
    'Phase A: winner identified for group ' || p_group_id,
    p_session_label, v_session_id, p_group_id);
  v_change_log_count := v_change_log_count + 1;
  v_phase_a_done := clock_timestamp();

  -- ============================================================
  -- PHASE B: Contacts (intra-batch dedup already applied in plan)
  -- ============================================================
  v_phase := 'phase_b_contacts';
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_contacts_to_create) LOOP
    IF COALESCE((v_entry ->> 'would_be_skipped')::boolean, false) THEN
      v_contacts_skipped := v_contacts_skipped + 1;
      v_existing_contact_id := NULL;
      IF v_entry ->> 'skip_reason' = 'duplicate_contact_already_on_winner' THEN
        SELECT sc.id INTO v_existing_contact_id
        FROM store_contacts sc
        WHERE sc.store_id = v_winner_id
          AND lower(COALESCE(TRIM(sc.name),'')) = lower(COALESCE(TRIM(v_entry ->> 'name'),''))
          AND COALESCE(regexp_replace(COALESCE(sc.phone,''),'\D','','g'),'') =
              COALESCE(regexp_replace(COALESCE(v_entry ->> 'phone',''),'\D','','g'),'')
        LIMIT 1;
      END IF;

      INSERT INTO dynasty_change_log
        (change_type, entity_type, entity_id, before_data, after_data,
         notes, session_label, session_id, duplicate_group_id)
      VALUES (
        'merge_contact_skipped', 'store_contacts', NULL,
        jsonb_build_object('skip_reason', v_entry ->> 'skip_reason',
                           'attempted_data', v_entry),
        jsonb_build_object('merged_with_existing_contact_id', v_existing_contact_id,
                           'merged_with_loser_ids', v_entry -> 'merged_with_loser_ids'),
        'Phase B: contact skipped (' || COALESCE(v_entry ->> 'skip_reason','unknown') || ')',
        p_session_label, v_session_id, p_group_id);
      v_change_log_count := v_change_log_count + 1;
    ELSE
      INSERT INTO store_contacts
        (store_id, name, phone, email, source, original_store_id, created_via_session, notes)
      VALUES (
        v_winner_id,
        COALESCE(NULLIF(TRIM(v_entry ->> 'name'),''),'(unknown)'),
        NULLIF(v_entry ->> 'phone',''),
        NULLIF(v_entry ->> 'email',''),
        'merge_from_duplicate',
        (v_entry ->> 'from_loser_id')::uuid,
        v_session_id,
        format('Merged from %s loser store(s) via session %s',
               jsonb_array_length(COALESCE(v_entry -> 'merged_from_loser_ids','[]'::jsonb)),
               p_session_label))
      RETURNING id INTO v_new_contact_id;
      v_contacts_created := v_contacts_created + 1;

      INSERT INTO dynasty_change_log
        (change_type, entity_type, entity_id, before_data, after_data,
         notes, session_label, session_id, duplicate_group_id)
      VALUES (
        'merge_contact_created', 'store_contacts', v_new_contact_id,
        NULL,
        jsonb_build_object('store_id', v_winner_id,
                           'name', v_entry ->> 'name',
                           'phone', v_entry ->> 'phone',
                           'email', v_entry ->> 'email',
                           'source','merge_from_duplicate',
                           'original_store_id', v_entry ->> 'from_loser_id',
                           'merged_from_loser_ids', v_entry -> 'merged_from_loser_ids'),
        'Phase B: contact created on winner from loser data',
        p_session_label, v_session_id, p_group_id);
      v_change_log_count := v_change_log_count + 1;
    END IF;
  END LOOP;
  v_phase_b_done := clock_timestamp();

  -- ============================================================
  -- PHASE C: Field consolidation
  -- ============================================================
  v_phase := 'phase_c_field_consolidation';
  FOR v_field_entry IN SELECT * FROM jsonb_array_elements(v_consolidation) LOOP
    EXECUTE format('UPDATE %I SET %I = $1 WHERE id = $2 AND (%I IS NULL OR TRIM(%I::text) = '''')',
                   v_field_entry ->> 'target_table',
                   v_field_entry ->> 'target_column',
                   v_field_entry ->> 'target_column',
                   v_field_entry ->> 'target_column')
      USING v_field_entry ->> 'planned_value', v_winner_id;

    v_fields_consolidated := v_fields_consolidated + 1;
    INSERT INTO dynasty_change_log
      (change_type, entity_type, entity_id, before_data, after_data,
       notes, session_label, session_id, duplicate_group_id)
    VALUES (
      'merge_field_consolidated', v_field_entry ->> 'target_table', v_winner_id,
      jsonb_build_object('field', v_field_entry ->> 'field',
                         'target_table', v_field_entry ->> 'target_table',
                         'target_column', v_field_entry ->> 'target_column',
                         'previous_value', NULL),
      jsonb_build_object('field', v_field_entry ->> 'field',
                         'new_value', v_field_entry ->> 'planned_value',
                         'source_loser_id', v_field_entry ->> 'source_loser_id',
                         'source_updated_at', v_field_entry ->> 'source_updated_at'),
      'Phase C: field consolidated from loser',
      p_session_label, v_session_id, p_group_id);
    v_change_log_count := v_change_log_count + 1;
  END LOOP;
  v_phase_c_done := clock_timestamp();

  -- ============================================================
  -- PHASE D: FK re-point (mirror preview dedup rules exactly)
  -- ============================================================
  v_phase := 'phase_d_fk_repoint';
  FOR v_fk_entry IN SELECT * FROM jsonb_array_elements(v_fk_results) LOOP
    v_table       := v_fk_entry ->> 'table_name';
    v_skip_reason := v_fk_entry ->> 'skip_reason';
    v_repointed   := 0;
    v_loser_skipped := 0;

    IF v_table = 'store_notes' AND (v_fk_entry ->> 'referencing_column') = 'store_id' THEN
      -- Log dedup-skipped rows first
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data,
               (SELECT w.id FROM store_notes w
                 WHERE w.store_id = v_winner_id
                   AND lower(regexp_replace(COALESCE(w.note_text,''), '\s+', ' ', 'g')) =
                       lower(regexp_replace(COALESCE(l.note_text,''), '\s+', ' ', 'g'))
                 LIMIT 1) AS winner_match_id
        FROM store_notes l
        WHERE l.store_id = ANY(v_loser_ids)
          AND EXISTS (SELECT 1 FROM store_notes w
            WHERE w.store_id = v_winner_id
              AND lower(regexp_replace(COALESCE(w.note_text,''), '\s+', ' ', 'g')) =
                  lower(regexp_replace(COALESCE(l.note_text,''), '\s+', ' ', 'g')))
      LOOP
        INSERT INTO dynasty_change_log
          (change_type, entity_type, entity_id, before_data, after_data,
           notes, session_label, session_id, duplicate_group_id)
        VALUES ('merge_dedup_skipped','store_notes', v_skipped_rec.row_id,
          v_skipped_rec.row_data,
          jsonb_build_object('skip_reason', v_skip_reason,
                             'winner_match_id', v_skipped_rec.winner_match_id),
          'Row preserved on loser (which will be soft-deleted), not migrated to winner because winner already has equivalent record',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count + 1;
        v_loser_skipped := v_loser_skipped + 1;
      END LOOP;

      WITH upd AS (
        UPDATE store_notes l SET store_id = v_winner_id
        WHERE l.store_id = ANY(v_loser_ids)
          AND NOT EXISTS (SELECT 1 FROM store_notes w
            WHERE w.store_id = v_winner_id
              AND lower(regexp_replace(COALESCE(w.note_text,''), '\s+', ' ', 'g')) =
                  lower(regexp_replace(COALESCE(l.note_text,''), '\s+', ' ', 'g')))
        RETURNING 1)
      SELECT COUNT(*) INTO v_repointed FROM upd;

    ELSIF v_table = 'invoices' AND (v_fk_entry ->> 'referencing_column') = 'store_id' THEN
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data,
               (SELECT w.id FROM invoices w WHERE w.store_id=v_winner_id AND w.invoice_number=l.invoice_number LIMIT 1) AS winner_match_id
        FROM invoices l
        WHERE l.store_id = ANY(v_loser_ids)
          AND l.invoice_number IS NOT NULL
          AND EXISTS (SELECT 1 FROM invoices w WHERE w.store_id=v_winner_id AND w.invoice_number=l.invoice_number)
      LOOP
        INSERT INTO dynasty_change_log
          (change_type, entity_type, entity_id, before_data, after_data,
           notes, session_label, session_id, duplicate_group_id)
        VALUES ('merge_dedup_skipped','invoices', v_skipped_rec.row_id,
          v_skipped_rec.row_data,
          jsonb_build_object('skip_reason', v_skip_reason,
                             'winner_match_id', v_skipped_rec.winner_match_id),
          'Row preserved on loser (soft-deleted), not migrated — winner has same invoice_number',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count + 1;
        v_loser_skipped := v_loser_skipped + 1;
      END LOOP;

      WITH upd AS (
        UPDATE invoices l SET store_id = v_winner_id
        WHERE l.store_id = ANY(v_loser_ids)
          AND NOT (l.invoice_number IS NOT NULL
                   AND EXISTS (SELECT 1 FROM invoices w WHERE w.store_id=v_winner_id AND w.invoice_number=l.invoice_number))
        RETURNING 1)
      SELECT COUNT(*) INTO v_repointed FROM upd;

    ELSIF v_table = 'orders' AND (v_fk_entry ->> 'referencing_column') = 'store_id' THEN
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data
        FROM orders l
        WHERE l.store_id = ANY(v_loser_ids)
          AND ((l.short_code IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=v_winner_id AND w.short_code=l.short_code))
            OR (l.external_ref IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=v_winner_id AND w.external_ref=l.external_ref)))
      LOOP
        INSERT INTO dynasty_change_log
          (change_type, entity_type, entity_id, before_data, after_data,
           notes, session_label, session_id, duplicate_group_id)
        VALUES ('merge_dedup_skipped','orders', v_skipped_rec.row_id,
          v_skipped_rec.row_data,
          jsonb_build_object('skip_reason', v_skip_reason),
          'Row preserved on loser (soft-deleted), not migrated — winner has same short_code/external_ref',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count + 1;
        v_loser_skipped := v_loser_skipped + 1;
      END LOOP;

      WITH upd AS (
        UPDATE orders l SET store_id = v_winner_id
        WHERE l.store_id = ANY(v_loser_ids)
          AND NOT (
            (l.short_code IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=v_winner_id AND w.short_code=l.short_code))
            OR (l.external_ref IS NOT NULL AND EXISTS (SELECT 1 FROM orders w WHERE w.store_id=v_winner_id AND w.external_ref=l.external_ref)))
        RETURNING 1)
      SELECT COUNT(*) INTO v_repointed FROM upd;

    ELSIF v_table = 'communication_events' AND (v_fk_entry ->> 'referencing_column') = 'store_id' THEN
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data
        FROM communication_events l
        WHERE l.store_id = ANY(v_loser_ids)
          AND EXISTS (SELECT 1 FROM communication_events w
            WHERE w.store_id=v_winner_id
              AND date_trunc('second', w.created_at)=date_trunc('second', l.created_at)
              AND w.channel IS NOT DISTINCT FROM l.channel
              AND w.event_type IS NOT DISTINCT FROM l.event_type)
      LOOP
        INSERT INTO dynasty_change_log
          (change_type, entity_type, entity_id, before_data, after_data,
           notes, session_label, session_id, duplicate_group_id)
        VALUES ('merge_dedup_skipped','communication_events', v_skipped_rec.row_id,
          v_skipped_rec.row_data,
          jsonb_build_object('skip_reason', v_skip_reason),
          'Row preserved on loser (soft-deleted), winner has equivalent comm event',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count + 1;
        v_loser_skipped := v_loser_skipped + 1;
      END LOOP;

      WITH upd AS (
        UPDATE communication_events l SET store_id = v_winner_id
        WHERE l.store_id = ANY(v_loser_ids)
          AND NOT EXISTS (SELECT 1 FROM communication_events w
            WHERE w.store_id=v_winner_id
              AND date_trunc('second', w.created_at)=date_trunc('second', l.created_at)
              AND w.channel IS NOT DISTINCT FROM l.channel
              AND w.event_type IS NOT DISTINCT FROM l.event_type)
        RETURNING 1)
      SELECT COUNT(*) INTO v_repointed FROM upd;

    ELSIF v_table = 'manual_call_logs' AND (v_fk_entry ->> 'referencing_column') = 'store_id' THEN
      FOR v_skipped_rec IN
        SELECT l.id AS row_id, to_jsonb(l) AS row_data
        FROM manual_call_logs l
        WHERE l.store_id = ANY(v_loser_ids)
          AND EXISTS (SELECT 1 FROM manual_call_logs w
            WHERE w.store_id=v_winner_id
              AND date_trunc('second', w.created_at)=date_trunc('second', l.created_at)
              AND w.outcome IS NOT DISTINCT FROM l.outcome)
      LOOP
        INSERT INTO dynasty_change_log
          (change_type, entity_type, entity_id, before_data, after_data,
           notes, session_label, session_id, duplicate_group_id)
        VALUES ('merge_dedup_skipped','manual_call_logs', v_skipped_rec.row_id,
          v_skipped_rec.row_data,
          jsonb_build_object('skip_reason', v_skip_reason),
          'Row preserved on loser (soft-deleted), winner has equivalent call log',
          p_session_label, v_session_id, p_group_id);
        v_change_log_count := v_change_log_count + 1;
        v_loser_skipped := v_loser_skipped + 1;
      END LOOP;

      WITH upd AS (
        UPDATE manual_call_logs l SET store_id = v_winner_id
        WHERE l.store_id = ANY(v_loser_ids)
          AND NOT EXISTS (SELECT 1 FROM manual_call_logs w
            WHERE w.store_id=v_winner_id
              AND date_trunc('second', w.created_at)=date_trunc('second', l.created_at)
              AND w.outcome IS NOT DISTINCT FROM l.outcome)
        RETURNING 1)
      SELECT COUNT(*) INTO v_repointed FROM upd;

    ELSE
      -- Generic blanket re-point (no dedup)
      EXECUTE format('WITH upd AS (UPDATE %I SET %I = $1 WHERE %I = ANY($2) RETURNING 1) SELECT COUNT(*) FROM upd',
                     v_table, v_fk_entry ->> 'referencing_column', v_fk_entry ->> 'referencing_column')
        INTO v_repointed USING v_winner_id, v_loser_ids;
    END IF;

    v_total_repoint    := v_total_repoint + v_repointed;
    v_total_dedup_skip := v_total_dedup_skip + v_loser_skipped;

    INSERT INTO dynasty_change_log
      (change_type, entity_type, entity_id, before_data, after_data,
       notes, session_label, session_id, duplicate_group_id)
    VALUES (
      'merge_fk_repointed', v_table, v_winner_id,
      jsonb_build_object('loser_ids', to_jsonb(v_loser_ids),
                         'rows_to_repoint', v_fk_entry -> 'rows_to_repoint',
                         'rows_planned_skipped', v_fk_entry -> 'rows_to_skip_dedup'),
      jsonb_build_object('new_store_id', v_winner_id,
                         'rows_actually_repointed', v_repointed,
                         'skipped_due_to_dedup', v_loser_skipped),
      format('Phase D: re-pointed %s row(s) in %s, skipped %s', v_repointed, v_table, v_loser_skipped),
      p_session_label, v_session_id, p_group_id);
    v_change_log_count := v_change_log_count + 1;
  END LOOP;
  v_phase_d_done := clock_timestamp();

  -- ============================================================
  -- PHASE E: Soft-delete losers
  -- ============================================================
  v_phase := 'phase_e_soft_delete';
  FOREACH v_loser_id IN ARRAY v_loser_ids LOOP
    -- stores
    SELECT to_jsonb(s) INTO v_before FROM stores s WHERE s.id = v_loser_id AND s.deleted_at IS NULL;
    IF v_before IS NOT NULL THEN
      UPDATE stores
        SET deleted_at = now(),
            deleted_reason = 'merged_into_winner_' || v_winner_id::text
        WHERE id = v_loser_id;
      v_soft_deletes := v_soft_deletes + 1;
      INSERT INTO dynasty_change_log
        (change_type, entity_type, entity_id, related_entity_id,
         before_data, after_data, notes, session_label, session_id, duplicate_group_id)
      VALUES ('merge_soft_deleted_stores','stores', v_loser_id, v_winner_id,
        v_before,
        jsonb_build_object('deleted_at', now(), 'merged_into', v_winner_id),
        'Phase E: stores row soft-deleted (merged into winner)',
        p_session_label, v_session_id, p_group_id);
      v_change_log_count := v_change_log_count + 1;
    END IF;

    -- store_master
    SELECT to_jsonb(sm) INTO v_before FROM store_master sm WHERE sm.id = v_loser_id AND sm.deleted_at IS NULL;
    IF v_before IS NOT NULL THEN
      UPDATE store_master
        SET deleted_at = now(),
            deleted_reason = 'merged_into_winner_' || v_winner_id::text
        WHERE id = v_loser_id;
      v_soft_deletes := v_soft_deletes + 1;
      INSERT INTO dynasty_change_log
        (change_type, entity_type, entity_id, related_entity_id,
         before_data, after_data, notes, session_label, session_id, duplicate_group_id)
      VALUES ('merge_soft_deleted_store_master','store_master', v_loser_id, v_winner_id,
        v_before,
        jsonb_build_object('deleted_at', now(), 'merged_into', v_winner_id),
        'Phase E: store_master row soft-deleted (merged into winner)',
        p_session_label, v_session_id, p_group_id);
      v_change_log_count := v_change_log_count + 1;
    END IF;
  END LOOP;
  v_phase_e_done := clock_timestamp();

  -- ============================================================
  -- PHASE F: Session complete entry
  -- ============================================================
  v_phase := 'phase_f_session_complete';
  v_after := jsonb_build_object(
    'session_id', v_session_id,
    'session_label', p_session_label,
    'group_id', p_group_id,
    'winner_store_id', v_winner_id,
    'losers_processed', COALESCE(array_length(v_loser_ids,1),0),
    'contacts_created', v_contacts_created,
    'contacts_skipped', v_contacts_skipped,
    'fields_consolidated', v_fields_consolidated,
    'fk_rows_repointed', v_total_repoint,
    'fk_rows_skipped_dedup', v_total_dedup_skip,
    'soft_deletes', v_soft_deletes,
    'total_change_log_entries', v_change_log_count + 1,
    'duration_seconds', EXTRACT(EPOCH FROM (now() - v_started_at)),
    'phase_a_completed_at', v_phase_a_done,
    'phase_b_completed_at', v_phase_b_done,
    'phase_c_completed_at', v_phase_c_done,
    'phase_d_completed_at', v_phase_d_done,
    'phase_e_completed_at', v_phase_e_done
  );

  INSERT INTO dynasty_change_log
    (change_type, entity_type, entity_id, before_data, after_data,
     notes, session_label, session_id, duplicate_group_id)
  VALUES (
    'merge_session_completed', 'merge_session', v_session_id,
    v_plan,
    v_after,
    format('Merge of group %s completed successfully. All loser data preserved via FK re-point and dedup-skip log entries. Losers soft-deleted from stores and store_master.', p_group_id),
    p_session_label, v_session_id, p_group_id);
  v_change_log_count := v_change_log_count + 1;

  RETURN jsonb_build_object(
    'success', true,
    'group_id', p_group_id,
    'session_id', v_session_id,
    'session_label', p_session_label,
    'winner_store_id', v_winner_id,
    'losers_processed', COALESCE(array_length(v_loser_ids,1),0),
    'contacts_created', v_contacts_created,
    'contacts_skipped', v_contacts_skipped,
    'fields_consolidated', v_fields_consolidated,
    'fk_rows_repointed', v_total_repoint,
    'fk_rows_skipped_dedup', v_total_dedup_skip,
    'soft_deletes', v_soft_deletes,
    'change_log_entries_written', v_change_log_count,
    'duration_seconds', EXTRACT(EPOCH FROM (now() - v_started_at)),
    'started_at', v_started_at,
    'completed_at', now()
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Merge execution failed in phase % for group %: %. Transaction rolled back, no data modified.',
    v_phase, p_group_id, SQLERRM
    USING DETAIL = format('session_id=%s', v_session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_store_merge_group(integer, text, boolean) TO authenticated;

-- ============================================================
-- 3. verify_merge_session — read-only audit helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_merge_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary jsonb;
  v_breakdown jsonb;
  v_soft_deleted jsonb;
  v_contacts jsonb;
  v_session_row jsonb;
BEGIN
  SELECT after_data INTO v_session_row
  FROM dynasty_change_log
  WHERE session_id = p_session_id AND change_type = 'merge_session_completed'
  LIMIT 1;

  SELECT jsonb_object_agg(change_type, cnt) INTO v_breakdown
  FROM (SELECT change_type, COUNT(*) cnt FROM dynasty_change_log
        WHERE session_id = p_session_id GROUP BY change_type) s;

  SELECT jsonb_agg(jsonb_build_object('store_id', entity_id, 'entity_type', entity_type,
                                      'merged_into', related_entity_id))
  INTO v_soft_deleted
  FROM dynasty_change_log
  WHERE session_id = p_session_id
    AND change_type IN ('merge_soft_deleted_stores','merge_soft_deleted_store_master');

  SELECT jsonb_agg(jsonb_build_object(
    'contact_id', sc.id, 'name', sc.name, 'phone', sc.phone, 'email', sc.email,
    'store_id', sc.store_id, 'original_store_id', sc.original_store_id,
    'source', sc.source))
  INTO v_contacts
  FROM store_contacts sc
  WHERE sc.created_via_session = p_session_id;

  v_summary := jsonb_build_object(
    'session_id', p_session_id,
    'session_summary', v_session_row,
    'change_log_breakdown', COALESCE(v_breakdown,'{}'::jsonb),
    'soft_deleted_records', COALESCE(v_soft_deleted,'[]'::jsonb),
    'contacts_created', COALESCE(v_contacts,'[]'::jsonb),
    'total_change_log_rows', (SELECT COUNT(*) FROM dynasty_change_log WHERE session_id = p_session_id)
  );
  RETURN v_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_merge_session(uuid) TO authenticated;
