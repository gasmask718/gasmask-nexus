
-- ============================================================================
-- DRY-RUN MERGE PREVIEW FUNCTION
-- Returns the full merge plan for a single duplicate group without mutating.
-- COALESCE pattern: name from store_master first, phone/email/address from
-- stores first (per drift analysis). Empty strings treated as NULL.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preview_store_merge_group(p_group_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_winner_field_source text;
  v_best_loser_id uuid;
  v_best_loser_value text;
  v_best_loser_source text;
  v_best_loser_updated timestamptz;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. Resolve group → store_ids
  -- ---------------------------------------------------------------------------
  SELECT duplicate_group_id, normalized_address, store_ids
    INTO v_group_record
  FROM detect_store_address_duplicates() d
  WHERE d.duplicate_group_id = p_group_id
  LIMIT 1;

  IF v_group_record IS NULL THEN
    RETURN jsonb_build_object('error', 'group_not_found', 'group_id', p_group_id);
  END IF;

  v_normalized_address := v_group_record.normalized_address;
  v_store_ids := v_group_record.store_ids;

  -- ---------------------------------------------------------------------------
  -- 2. Check for manual override winner
  -- ---------------------------------------------------------------------------
  SELECT manual_winner_store_id
    INTO v_override_winner
  FROM dynasty_merge_overrides
  WHERE duplicate_group_id = p_group_id
  LIMIT 1;

  -- ---------------------------------------------------------------------------
  -- 3. Build per-record activity profile and select winner
  --    Winner = highest total_activity_score, tiebreaker = oldest created_at
  -- ---------------------------------------------------------------------------
  IF v_override_winner IS NOT NULL AND v_override_winner = ANY(v_store_ids) THEN
    v_winner_id := v_override_winner;
  ELSE
    SELECT a.store_id
      INTO v_winner_id
    FROM analyze_store_duplicate_groups() a
    WHERE a.duplicate_group_id = p_group_id
    ORDER BY a.total_activity_score DESC NULLS LAST,
             a.created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_winner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_winner_found', 'group_id', p_group_id);
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4. Compute winner's effective values (for typo heuristic baseline)
  --    NAME: store_master.store_name first → stores.name
  --    PHONE: stores.phone first → store_master.phone
  -- ---------------------------------------------------------------------------
  SELECT
    COALESCE(NULLIF(TRIM(sm.store_name), ''), NULLIF(TRIM(s.name), '')),
    COALESCE(NULLIF(TRIM(s.phone), ''), NULLIF(TRIM(sm.phone), ''))
  INTO v_winner_eff_name, v_winner_eff_phone
  FROM (SELECT v_winner_id AS id) k
  LEFT JOIN stores s ON s.id = k.id
  LEFT JOIN store_master sm ON sm.id = k.id;

  v_winner_norm_name  := lower(COALESCE(TRIM(v_winner_eff_name), ''));
  v_winner_norm_phone := COALESCE(regexp_replace(COALESCE(v_winner_eff_phone, ''), '\D', '', 'g'), '');

  -- ---------------------------------------------------------------------------
  -- 5. Build winner snapshot (with provenance per field)
  -- ---------------------------------------------------------------------------
  SELECT jsonb_build_object(
    'store_id', v_winner_id,
    'effective_name', v_winner_eff_name,
    'name_source', CASE
      WHEN NULLIF(TRIM(sm.store_name), '') IS NOT NULL THEN 'store_master.store_name'
      WHEN NULLIF(TRIM(s.name), '') IS NOT NULL THEN 'stores.name'
      ELSE 'none'
    END,
    'effective_phone', v_winner_eff_phone,
    'phone_source', CASE
      WHEN NULLIF(TRIM(s.phone), '') IS NOT NULL THEN 'stores.phone'
      WHEN NULLIF(TRIM(sm.phone), '') IS NOT NULL THEN 'store_master.phone'
      ELSE 'none'
    END,
    'effective_email', COALESCE(NULLIF(TRIM(s.email), ''), NULLIF(TRIM(sm.email), '')),
    'email_source', CASE
      WHEN NULLIF(TRIM(s.email), '') IS NOT NULL THEN 'stores.email'
      WHEN NULLIF(TRIM(sm.email), '') IS NOT NULL THEN 'store_master.email'
      ELSE 'none'
    END,
    'effective_address', COALESCE(NULLIF(TRIM(s.address_street), ''), NULLIF(TRIM(sm.address), '')),
    'address_source', CASE
      WHEN NULLIF(TRIM(s.address_street), '') IS NOT NULL THEN 'stores.address_street'
      WHEN NULLIF(TRIM(sm.address), '') IS NOT NULL THEN 'store_master.address'
      ELSE 'none'
    END,
    'effective_city',  COALESCE(NULLIF(TRIM(s.address_city), ''),  NULLIF(TRIM(sm.city), '')),
    'effective_state', COALESCE(NULLIF(TRIM(s.address_state), ''), NULLIF(TRIM(sm.state), '')),
    'effective_zip',   COALESCE(NULLIF(TRIM(s.address_zip), ''),   NULLIF(TRIM(sm.zip), '')),
    'stores_exists', s.id IS NOT NULL,
    'store_master_exists', sm.id IS NOT NULL,
    'created_at', LEAST(s.created_at, sm.created_at),
    'is_override', (v_override_winner IS NOT NULL AND v_override_winner = v_winner_id),
    'activity_score', (
      SELECT a.total_activity_score
      FROM analyze_store_duplicate_groups() a
      WHERE a.store_id = v_winner_id AND a.duplicate_group_id = p_group_id
      LIMIT 1
    )
  )
  INTO v_winner_record
  FROM (SELECT v_winner_id AS id) k
  LEFT JOIN stores s ON s.id = k.id
  LEFT JOIN store_master sm ON sm.id = k.id;

  -- ---------------------------------------------------------------------------
  -- 6. For each loser: classify (typo vs person) and build plan
  -- ---------------------------------------------------------------------------
  FOREACH v_loser_id IN ARRAY v_store_ids
  LOOP
    CONTINUE WHEN v_loser_id = v_winner_id;

    SELECT
      COALESCE(NULLIF(TRIM(sm.store_name), ''), NULLIF(TRIM(s.name), '')),
      COALESCE(NULLIF(TRIM(s.phone), ''), NULLIF(TRIM(sm.phone), '')),
      COALESCE(NULLIF(TRIM(s.email), ''), NULLIF(TRIM(sm.email), ''))
    INTO v_loser_eff_name, v_loser_eff_phone, v_loser_eff_email
    FROM (SELECT v_loser_id AS id) k
    LEFT JOIN stores s ON s.id = k.id
    LEFT JOIN store_master sm ON sm.id = k.id;

    v_loser_norm_name  := lower(COALESCE(TRIM(v_loser_eff_name), ''));
    v_loser_norm_phone := COALESCE(regexp_replace(COALESCE(v_loser_eff_phone, ''), '\D', '', 'g'), '');

    -- Typo heuristic: empty-vs-empty counts as match
    v_is_typo := (v_loser_norm_name  = v_winner_norm_name)
             AND (v_loser_norm_phone = v_winner_norm_phone);

    -- Build full loser snapshot
    SELECT jsonb_build_object(
      'store_id', v_loser_id,
      'effective_name', v_loser_eff_name,
      'name_source', CASE
        WHEN NULLIF(TRIM(sm.store_name), '') IS NOT NULL THEN 'store_master.store_name'
        WHEN NULLIF(TRIM(s.name), '') IS NOT NULL THEN 'stores.name'
        ELSE 'none'
      END,
      'effective_phone', v_loser_eff_phone,
      'phone_source', CASE
        WHEN NULLIF(TRIM(s.phone), '') IS NOT NULL THEN 'stores.phone'
        WHEN NULLIF(TRIM(sm.phone), '') IS NOT NULL THEN 'store_master.phone'
        ELSE 'none'
      END,
      'effective_email', v_loser_eff_email,
      'email_source', CASE
        WHEN NULLIF(TRIM(s.email), '') IS NOT NULL THEN 'stores.email'
        WHEN NULLIF(TRIM(sm.email), '') IS NOT NULL THEN 'store_master.email'
        ELSE 'none'
      END,
      'normalized_name', v_loser_norm_name,
      'normalized_phone', v_loser_norm_phone,
      'classification', CASE WHEN v_is_typo THEN 'typo_duplicate' ELSE 'real_person_contact' END,
      'stores_exists', s.id IS NOT NULL,
      'store_master_exists', sm.id IS NOT NULL,
      'created_at', LEAST(s.created_at, sm.created_at),
      'updated_at', GREATEST(s.updated_at, sm.updated_at),
      'activity_score', (
        SELECT a.total_activity_score
        FROM analyze_store_duplicate_groups() a
        WHERE a.store_id = v_loser_id AND a.duplicate_group_id = p_group_id
        LIMIT 1
      )
    )
    INTO v_loser_data
    FROM (SELECT v_loser_id AS id) k
    LEFT JOIN stores s ON s.id = k.id
    LEFT JOIN store_master sm ON sm.id = k.id;

    v_losers := v_losers || v_loser_data;

    -- -------------------------------------------------------------------------
    -- Phase B: if real-person, plan a contact creation
    -- -------------------------------------------------------------------------
    IF NOT v_is_typo THEN
      -- Dedup: does winner already have a contact with this name+phone?
      SELECT EXISTS (
        SELECT 1 FROM store_contacts sc
        WHERE sc.store_id = v_winner_id
          AND lower(COALESCE(TRIM(sc.name), '')) = v_loser_norm_name
          AND COALESCE(regexp_replace(COALESCE(sc.phone, ''), '\D', '', 'g'), '') = v_loser_norm_phone
      ) INTO v_existing_contact;

      v_contacts_to_create := v_contacts_to_create || jsonb_build_object(
        'from_loser_id', v_loser_id,
        'name', v_loser_eff_name,
        'phone', NULLIF(v_loser_norm_phone, ''),
        'email', v_loser_eff_email,
        'would_be_skipped', v_existing_contact,
        'skip_reason', CASE WHEN v_existing_contact THEN 'duplicate_contact_already_on_winner' ELSE NULL END,
        'planned_notes', 'Auto-created during dedup merge on ' || to_char(now(), 'YYYY-MM-DD') ||
                         '. Originally separate store record (' || v_loser_id::text || ').'
      );
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 7. Phase C: Field-level consolidation plan on winner
  --    For each merge-eligible field, if winner is blank and any loser
  --    has a value, copy from most-recently-updated loser.
  -- ---------------------------------------------------------------------------
  FOR v_field IN
    SELECT * FROM (VALUES
      ('phone',         'stores',       'phone'),
      ('email',         'stores',       'email'),
      ('store_name',    'store_master', 'store_name'),
      ('owner_name',    'store_master', 'owner_name'),
      ('contact_name',  'store_master', 'contact_name'),
      ('address',       'store_master', 'address'),
      ('city',          'store_master', 'city'),
      ('state',         'store_master', 'state'),
      ('zip',           'store_master', 'zip'),
      ('nickname',      'store_master', 'nickname')
    ) AS t(field_label, target_table, target_column)
  LOOP
    -- Winner's current value on the target table
    EXECUTE format(
      'SELECT NULLIF(TRIM(%I::text), '''') FROM %I WHERE id = $1',
      v_field.target_column, v_field.target_table
    ) INTO v_winner_field_value USING v_winner_id;

    IF v_winner_field_value IS NOT NULL THEN
      CONTINUE;  -- winner has value; keep it
    END IF;

    -- Find best loser value (most recently updated, non-blank)
    EXECUTE format($q$
      SELECT id, NULLIF(TRIM(%I::text), '') AS val, updated_at
      FROM %I
      WHERE id = ANY($1)
        AND id <> $2
        AND NULLIF(TRIM(%I::text), '') IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
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

  -- ---------------------------------------------------------------------------
  -- 8. Return full plan
  -- ---------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'group_id', p_group_id,
    'normalized_address', v_normalized_address,
    'group_size', array_length(v_store_ids, 1),
    'all_store_ids', to_jsonb(v_store_ids),
    'winner', v_winner_record,
    'losers', v_losers,
    'losers_count', jsonb_array_length(v_losers),
    'typo_duplicates_count', (
      SELECT COUNT(*) FROM jsonb_array_elements(v_losers) e
      WHERE e->>'classification' = 'typo_duplicate'
    ),
    'real_person_contacts_count', (
      SELECT COUNT(*) FROM jsonb_array_elements(v_losers) e
      WHERE e->>'classification' = 'real_person_contact'
    ),
    'contacts_to_create', v_contacts_to_create,
    'contacts_to_skip_count', (
      SELECT COUNT(*) FROM jsonb_array_elements(v_contacts_to_create) e
      WHERE (e->>'would_be_skipped')::boolean
    ),
    'field_consolidation', v_consolidation,
    'field_consolidation_count', jsonb_array_length(v_consolidation),
    'preview_generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_store_merge_group(integer) TO authenticated;
