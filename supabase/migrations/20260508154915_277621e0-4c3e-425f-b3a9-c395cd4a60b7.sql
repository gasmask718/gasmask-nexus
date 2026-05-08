CREATE OR REPLACE FUNCTION public.reverse_corrupted_merge(
  p_session_id uuid,
  p_session_label text,
  p_dry_run boolean DEFAULT true,
  p_force_cascade boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_record record;
  v_bad_winner uuid;
  v_candidates uuid[];
  v_correct_winner uuid;
  v_normalized_address text;
  v_recovery_session_id uuid := gen_random_uuid();
  v_started_at timestamptz := now();

  v_downstream_session uuid;

  v_fk_repointed int := 0;
  v_contacts_moved int := 0;
  v_soft_deletes_reversed int := 0;
  v_change_log_count int := 0;

  v_fk_record record;
  v_phase text := 'init';
BEGIN
  -- PHASE 0: load corruption record
  v_phase := 'phase_0_load';

  SELECT
    cl.session_id,
    cl.session_label,
    cl.duplicate_group_id,
    cl.before_data->>'normalized_address' AS norm_addr,
    (cl.after_data->>'selected_winner')::uuid AS bad_winner,
    ARRAY(SELECT jsonb_array_elements_text(cl.before_data->'candidate_store_ids')::uuid) AS candidates
  INTO v_session_record
  FROM dynasty_change_log cl
  WHERE cl.session_id = p_session_id
    AND cl.change_type = 'merge_winner_selected'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('aborted', true, 'reason', 'session_not_found',
      'session_id', p_session_id);
  END IF;

  v_bad_winner := v_session_record.bad_winner;
  v_candidates := v_session_record.candidates;
  v_normalized_address := v_session_record.norm_addr;

  IF v_bad_winner = ANY(v_candidates) THEN
    RETURN jsonb_build_object('aborted', true, 'reason', 'session_not_corrupted',
      'session_id', p_session_id,
      'message', 'bad_winner is in candidates — this session was NOT corrupted, no recovery needed');
  END IF;

  -- PHASE 1: select correct winner
  v_phase := 'phase_1_select_correct_winner';

  SELECT a.store_id INTO v_correct_winner
  FROM dynasty_merge_analysis_cache a
  WHERE a.store_id = ANY(v_candidates)
  ORDER BY a.total_activity_score DESC NULLS LAST,
           a.created_at ASC NULLS LAST,
           a.store_id ASC
  LIMIT 1;

  IF v_correct_winner IS NULL THEN
    SELECT s.id INTO v_correct_winner
    FROM unnest(v_candidates) u(id)
    JOIN stores s ON s.id = u.id
    ORDER BY
      CASE WHEN s.deleted_at IS NULL THEN 0 ELSE 1 END,
      s.created_at ASC NULLS LAST,
      s.id ASC
    LIMIT 1;
  END IF;

  IF v_correct_winner IS NULL THEN
    RETURN jsonb_build_object('aborted', true, 'reason', 'no_correct_winner_findable',
      'session_id', p_session_id, 'candidates', to_jsonb(v_candidates));
  END IF;

  -- PHASE 2: cascade dependency check
  v_phase := 'phase_2_cascade_check';

  SELECT cl.session_id INTO v_downstream_session
  FROM dynasty_change_log cl
  WHERE cl.change_type = 'merge_winner_selected'
    AND v_bad_winner::text IN (
      SELECT jsonb_array_elements_text(cl.before_data->'candidate_store_ids')
    )
    AND cl.performed_at > (
      SELECT performed_at FROM dynasty_change_log
      WHERE session_id = p_session_id AND change_type = 'merge_winner_selected'
      LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM dynasty_change_log r
      WHERE r.session_id = cl.session_id
        AND r.change_type = 'merge_reversed'
    )
  LIMIT 1;

  IF v_downstream_session IS NOT NULL AND NOT p_force_cascade THEN
    RETURN jsonb_build_object('aborted', true, 'reason', 'unresolved_cascade',
      'session_id', p_session_id,
      'downstream_session', v_downstream_session,
      'message', 'bad_winner was a loser in a later corrupted session that has not been reversed yet. Reverse the downstream session first, or pass p_force_cascade=true.');
  END IF;

  -- PHASE 3: dry-run plan
  v_phase := 'phase_3_compute_changes';

  IF p_dry_run THEN
    DECLARE
      v_plan_fk_changes jsonb := '[]'::jsonb;
      v_plan_contact_changes jsonb;
      v_plan_soft_delete_reversals jsonb;
      v_plan_bad_winner_state text;
    BEGIN
      FOR v_fk_record IN
        SELECT entity_type AS table_name,
               (after_data->>'rows_actually_repointed')::int AS rows_to_reverse,
               (after_data->>'skipped_due_to_dedup')::int AS dedup_skipped
        FROM dynasty_change_log
        WHERE session_id = p_session_id
          AND change_type = 'merge_fk_repointed'
      LOOP
        v_plan_fk_changes := v_plan_fk_changes || jsonb_build_object(
          'table', v_fk_record.table_name,
          'rows_to_reverse', v_fk_record.rows_to_reverse,
          'rows_dedup_skipped_originally', v_fk_record.dedup_skipped,
          'reverse_target', v_correct_winner
        );
      END LOOP;

      SELECT jsonb_agg(jsonb_build_object(
        'contact_id', sc.id,
        'name', sc.name,
        'phone', sc.phone,
        'currently_on', sc.store_id,
        'should_move_to', v_correct_winner,
        'original_loser', sc.original_store_id
      ))
      INTO v_plan_contact_changes
      FROM store_contacts sc
      WHERE sc.created_via_session = p_session_id;

      SELECT jsonb_agg(jsonb_build_object(
        'candidate_id', s.id,
        'name', s.name,
        'currently_deleted', s.deleted_at IS NOT NULL,
        'will_be_restored_as_winner', s.id = v_correct_winner,
        'will_remain_soft_deleted', s.id <> v_correct_winner
      ))
      INTO v_plan_soft_delete_reversals
      FROM stores s
      WHERE s.id = ANY(v_candidates);

      SELECT
        CASE WHEN s.deleted_at IS NOT NULL THEN 'remains_soft_deleted'
             ELSE 'will_be_left_as_is' END
      INTO v_plan_bad_winner_state
      FROM stores s WHERE s.id = v_bad_winner;

      RETURN jsonb_build_object(
        'dry_run', true,
        'session_id', p_session_id,
        'session_label', v_session_record.session_label,
        'normalized_address', v_normalized_address,
        'bad_winner', v_bad_winner,
        'correct_winner', v_correct_winner,
        'candidates', to_jsonb(v_candidates),
        'cascade_check', jsonb_build_object(
          'has_unresolved_downstream', v_downstream_session IS NOT NULL,
          'downstream_session', v_downstream_session
        ),
        'planned_changes', jsonb_build_object(
          'fk_table_reversals', COALESCE(v_plan_fk_changes, '[]'::jsonb),
          'contact_reassignments', COALESCE(v_plan_contact_changes, '[]'::jsonb),
          'soft_delete_reversals', COALESCE(v_plan_soft_delete_reversals, '[]'::jsonb),
          'bad_winner_post_state', v_plan_bad_winner_state
        ),
        'recovery_session_id', v_recovery_session_id,
        'computed_at', now(),
        'message', 'DRY-RUN complete. Pass p_dry_run=false to execute.'
      );
    END;
  END IF;

  -- PHASE 4: execute
  v_phase := 'phase_4_execute';

  FOR v_fk_record IN
    SELECT DISTINCT entity_type AS table_name
    FROM dynasty_change_log
    WHERE session_id = p_session_id
      AND change_type = 'merge_fk_repointed'
  LOOP
    EXECUTE format('UPDATE %I SET store_id = $1 WHERE store_id = $2', v_fk_record.table_name)
      USING v_correct_winner, v_bad_winner;
    GET DIAGNOSTICS v_fk_repointed = ROW_COUNT;

    INSERT INTO dynasty_change_log (
      change_type, entity_type, entity_id,
      before_data, after_data, notes,
      session_label, session_id, duplicate_group_id
    ) VALUES (
      'merge_reversed_fk_repoint', v_fk_record.table_name, NULL,
      jsonb_build_object('was_on', v_bad_winner, 'original_session', p_session_id),
      jsonb_build_object('moved_to', v_correct_winner, 'rows_moved', v_fk_repointed),
      format('Reverse: re-pointed %s rows in %s from bad_winner back to correct_winner',
             v_fk_repointed, v_fk_record.table_name),
      p_session_label, v_recovery_session_id, NULL
    );
    v_change_log_count := v_change_log_count + 1;
  END LOOP;

  UPDATE store_contacts
  SET store_id = v_correct_winner,
      notes = COALESCE(notes,'') || format(' [reversed via session %s]', v_recovery_session_id)
  WHERE created_via_session = p_session_id
    AND store_id = v_bad_winner;
  GET DIAGNOSTICS v_contacts_moved = ROW_COUNT;

  INSERT INTO dynasty_change_log (
    change_type, entity_type, entity_id,
    before_data, after_data, notes,
    session_label, session_id, duplicate_group_id
  ) VALUES (
    'merge_reversed_contacts', 'store_contacts', NULL,
    jsonb_build_object('was_on', v_bad_winner),
    jsonb_build_object('moved_to', v_correct_winner, 'contacts_moved', v_contacts_moved),
    format('Reverse: moved %s contacts from bad_winner to correct_winner', v_contacts_moved),
    p_session_label, v_recovery_session_id, NULL
  );
  v_change_log_count := v_change_log_count + 1;

  UPDATE stores
  SET deleted_at = NULL,
      deleted_reason = format('reversed_by_recovery_session_%s', v_recovery_session_id)
  WHERE id = v_correct_winner AND deleted_at IS NOT NULL;
  GET DIAGNOSTICS v_soft_deletes_reversed = ROW_COUNT;

  UPDATE store_master
  SET deleted_at = NULL,
      deleted_reason = format('reversed_by_recovery_session_%s', v_recovery_session_id)
  WHERE id = v_correct_winner AND deleted_at IS NOT NULL;

  INSERT INTO dynasty_change_log (
    change_type, entity_type, entity_id,
    before_data, after_data, notes,
    session_label, session_id, duplicate_group_id
  ) VALUES (
    'merge_reversed_restore', 'stores', v_correct_winner,
    jsonb_build_object('was_soft_deleted', v_soft_deletes_reversed > 0),
    jsonb_build_object('now_active', true, 'restored_as_correct_winner', true),
    format('Reverse: restored correct_winner %s from soft-delete', v_correct_winner),
    p_session_label, v_recovery_session_id, NULL
  );
  v_change_log_count := v_change_log_count + 1;

  INSERT INTO dynasty_change_log (
    change_type, entity_type, entity_id,
    before_data, after_data, notes,
    session_label, session_id, duplicate_group_id
  ) VALUES (
    'merge_reversed', 'merge_session', p_session_id,
    jsonb_build_object(
      'original_bad_winner', v_bad_winner,
      'original_candidates', to_jsonb(v_candidates),
      'normalized_address', v_normalized_address
    ),
    jsonb_build_object(
      'corrected_winner', v_correct_winner,
      'recovery_session_id', v_recovery_session_id,
      'fk_repointed', v_fk_repointed,
      'contacts_moved', v_contacts_moved,
      'soft_deletes_reversed', v_soft_deletes_reversed
    ),
    format('Original session %s fully reversed via recovery session %s',
           p_session_id, v_recovery_session_id),
    p_session_label, v_recovery_session_id, NULL
  );
  v_change_log_count := v_change_log_count + 1;

  RETURN jsonb_build_object(
    'success', true,
    'dry_run', false,
    'original_session_id', p_session_id,
    'recovery_session_id', v_recovery_session_id,
    'bad_winner', v_bad_winner,
    'correct_winner', v_correct_winner,
    'fk_rows_repointed', v_fk_repointed,
    'contacts_moved', v_contacts_moved,
    'soft_deletes_reversed', v_soft_deletes_reversed,
    'change_log_entries', v_change_log_count,
    'duration_seconds', EXTRACT(EPOCH FROM (now() - v_started_at)),
    'completed_at', now()
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Reverse-merge failed in phase % for session %: %. Transaction rolled back.',
    v_phase, p_session_id, SQLERRM;
END;
$$;