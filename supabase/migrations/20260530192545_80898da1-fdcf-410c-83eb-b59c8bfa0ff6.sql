CREATE OR REPLACE FUNCTION public.apply_field_submission(p_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_submission public.field_submissions%ROWTYPE;
  v_group_id uuid;
  v_new_store_id uuid;
  v_ambassador_id uuid;
BEGIN
  SELECT * INTO v_submission FROM public.field_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'submission not found');
  END IF;
  IF v_submission.is_applied THEN
    RETURN jsonb_build_object('success', false, 'error', 'already applied');
  END IF;

  CASE v_submission.entity_type::text
    -- ═══ NEW STORE (created from field portal) ═══
    WHEN 'new_store' THEN
      IF v_submission.action_type = 'create' THEN
        -- Resolve ambassador if submitter is an ambassador
        IF v_submission.submitted_by_role = 'ambassador' THEN
          SELECT id INTO v_ambassador_id
          FROM public.ambassadors
          WHERE user_id = v_submission.submitted_by_user_id
          LIMIT 1;
        END IF;

        INSERT INTO public.store_master (
          store_name, address, city, state, zip,
          phone, owner_name, notes,
          sourced_by_ambassador_id, assigned_ambassador_id, sourced_at
        ) VALUES (
          v_submission.payload_after->>'store_name',
          v_submission.payload_after->>'address',
          v_submission.payload_after->>'city',
          v_submission.payload_after->>'state',
          v_submission.payload_after->>'zip',
          NULLIF(v_submission.payload_after->>'phone',''),
          NULLIF(v_submission.payload_after->>'owner_name',''),
          NULLIF(
            concat_ws(E'\n',
              NULLIF(v_submission.payload_after->>'neighborhood',''),
              CASE WHEN v_submission.payload_after ? 'brand_interest'
                   THEN 'Brand interest: ' || (v_submission.payload_after->>'brand_interest')
                   END,
              NULLIF(v_submission.payload_after->>'notes','')
            ), ''),
          v_ambassador_id,
          v_ambassador_id,
          NOW()
        )
        RETURNING id INTO v_new_store_id;

        -- Backfill the submission with the resulting store_id for traceability
        UPDATE public.field_submissions
        SET store_id = v_new_store_id, entity_id = v_new_store_id
        WHERE id = p_submission_id;
      END IF;

    -- ═══ STORE BRAND STICKERS ═══
    WHEN 'sticker_change' THEN
      IF v_submission.action_type = 'update' AND v_submission.entity_id IS NOT NULL THEN
        UPDATE public.store_brand_stickers
        SET status = COALESCE((v_submission.payload_after->>'status')::boolean, status),
            updated_at = NOW()
        WHERE id = v_submission.entity_id;
      END IF;

    -- ═══ STORE CONTACTS ═══
    WHEN 'store_contact' THEN
      IF v_submission.action_type = 'create' THEN
        INSERT INTO public.store_contacts (
          store_id, name, phone, role, shirt_size, language, notes, is_primary
        ) VALUES (
          v_submission.store_id,
          v_submission.payload_after->>'name',
          v_submission.payload_after->>'phone',
          v_submission.payload_after->>'role',
          v_submission.payload_after->>'shirt_size',
          v_submission.payload_after->>'language',
          v_submission.payload_after->>'notes',
          COALESCE((v_submission.payload_after->>'is_primary')::boolean, false)
        );
      ELSIF v_submission.action_type = 'update' AND v_submission.entity_id IS NOT NULL THEN
        UPDATE public.store_contacts SET
          name = COALESCE(v_submission.payload_after->>'name', name),
          phone = COALESCE(v_submission.payload_after->>'phone', phone),
          role = COALESCE(v_submission.payload_after->>'role', role),
          shirt_size = COALESCE(v_submission.payload_after->>'shirt_size', shirt_size),
          language = COALESCE(v_submission.payload_after->>'language', language),
          notes = COALESCE(v_submission.payload_after->>'notes', notes),
          is_primary = COALESCE((v_submission.payload_after->>'is_primary')::boolean, is_primary)
        WHERE id = v_submission.entity_id;
      ELSIF v_submission.action_type = 'delete' AND v_submission.entity_id IS NOT NULL THEN
        DELETE FROM public.store_contacts WHERE id = v_submission.entity_id;
      END IF;

    WHEN 'tube_inventory' THEN
      IF v_submission.action_type IN ('create', 'update') THEN
        INSERT INTO public.store_tube_inventory_status (
          store_id, brand_id, color, status, last_updated_by, last_updated_at
        ) VALUES (
          v_submission.store_id,
          (v_submission.payload_after->>'brand_id')::uuid,
          v_submission.payload_after->>'color',
          COALESCE(v_submission.payload_after->>'status', 'in_stock'),
          v_submission.submitted_by_user_id,
          NOW()
        )
        ON CONFLICT (store_id, brand_id, color) DO UPDATE
          SET status = EXCLUDED.status,
              last_updated_by = EXCLUDED.last_updated_by,
              last_updated_at = EXCLUDED.last_updated_at;
      END IF;

    WHEN 'connected_store' THEN
      IF v_submission.action_type = 'create' THEN
        SELECT connected_store_group_id INTO v_group_id
        FROM public.store_master WHERE id = v_submission.store_id;
        IF v_group_id IS NULL THEN
          v_group_id := gen_random_uuid();
          UPDATE public.store_master SET connected_store_group_id = v_group_id
          WHERE id = v_submission.store_id;
        END IF;
      END IF;

    WHEN 'store_questionnaire' THEN
      IF v_submission.action_type IN ('create', 'update') THEN
        INSERT INTO public.store_questionnaire (
          store_id, security_level, sells_flowers, interested_cleaning_service,
          additional_items_wanted, top_selling_items, most_needed_items,
          last_verified_by, last_verified_at
        ) VALUES (
          v_submission.store_id,
          v_submission.payload_after->>'security_level',
          (v_submission.payload_after->>'sells_flowers')::boolean,
          (v_submission.payload_after->>'interested_cleaning_service')::boolean,
          v_submission.payload_after->>'additional_items_wanted',
          v_submission.payload_after->>'top_selling_items',
          v_submission.payload_after->>'most_needed_items',
          v_submission.submitted_by_user_id,
          NOW()
        )
        ON CONFLICT (store_id) DO UPDATE SET
          security_level = COALESCE(EXCLUDED.security_level, store_questionnaire.security_level),
          sells_flowers = COALESCE(EXCLUDED.sells_flowers, store_questionnaire.sells_flowers),
          interested_cleaning_service = COALESCE(EXCLUDED.interested_cleaning_service, store_questionnaire.interested_cleaning_service),
          additional_items_wanted = COALESCE(EXCLUDED.additional_items_wanted, store_questionnaire.additional_items_wanted),
          top_selling_items = COALESCE(EXCLUDED.top_selling_items, store_questionnaire.top_selling_items),
          most_needed_items = COALESCE(EXCLUDED.most_needed_items, store_questionnaire.most_needed_items),
          last_verified_by = EXCLUDED.last_verified_by,
          last_verified_at = EXCLUDED.last_verified_at;
      END IF;

    WHEN 'visit_log' THEN
      IF v_submission.action_type = 'create' THEN
        INSERT INTO public.visit_logs (store_id, visited_by, visit_type, notes, visited_at)
        VALUES (
          v_submission.store_id,
          v_submission.submitted_by_user_id,
          COALESCE(v_submission.payload_after->>'visit_type', 'check_in'),
          v_submission.payload_after->>'notes',
          COALESCE((v_submission.payload_after->>'visited_at')::timestamptz, NOW())
        );
      END IF;

    WHEN 'store_update' THEN
      IF v_submission.action_type = 'update' AND v_submission.store_id IS NOT NULL THEN
        UPDATE public.store_master SET
          phone = COALESCE(v_submission.payload_after->>'phone', phone),
          owner_name = COALESCE(v_submission.payload_after->>'owner_name', owner_name),
          notes = COALESCE(v_submission.payload_after->>'notes', notes)
        WHERE id = v_submission.store_id;
      END IF;

    ELSE
      NULL;
  END CASE;

  UPDATE public.field_submissions
  SET is_applied = true,
      submission_status = 'approved',
      applied_at = NOW()
  WHERE id = p_submission_id;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'new_store_id', v_new_store_id
  );
END;
$function$;