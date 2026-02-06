
CREATE OR REPLACE FUNCTION public.apply_field_submission(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission RECORD;
  v_result jsonb := '{}'::jsonb;
  v_governance_bypass_key text := 'authorized';
  v_field text;
  v_value text;
  v_update_method text;
  v_new_wholesaler_id uuid;
  v_group_id uuid;
BEGIN
  SELECT * INTO v_submission
  FROM public.field_submissions
  WHERE id = p_submission_id;
  
  IF v_submission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found', 'errorCode', 'NOT_FOUND');
  END IF;
  
  IF v_submission.submission_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission is not approved', 'errorCode', 'INVALID_STATUS', 'currentStatus', v_submission.submission_status);
  END IF;
  
  IF v_submission.is_applied THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission already applied', 'errorCode', 'ALREADY_APPLIED');
  END IF;
  
  PERFORM set_config('app.governance_bypass', v_governance_bypass_key, false);
  
  BEGIN
    CASE v_submission.entity_type

      -- ═══ BRAND STICKER (dynamic column update) ═══
      WHEN 'brand_sticker' THEN
        IF v_submission.action_type = 'update' THEN
          v_field := v_submission.payload_after->>'sticker_type';
          v_value := v_submission.payload_after->>'value';
          
          IF v_field IS NOT NULL AND v_submission.entity_id IS NOT NULL THEN
            EXECUTE format(
              'UPDATE public.store_brand_stickers SET %I = $1, updated_at = NOW() WHERE id = $2',
              v_field
            )
            USING (v_value)::boolean, v_submission.entity_id;
          END IF;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.store_brand_stickers WHERE id = v_submission.entity_id;
        END IF;

      -- ═══ TUBE INVENTORY ═══
      WHEN 'tube_inventory' THEN
        v_field := v_submission.payload_after->>'field';
        v_value := v_submission.payload_after->>'value';
        v_update_method := COALESCE(v_submission.payload_after->>'update_method', 'system');
        
        IF v_field IS NOT NULL AND v_submission.entity_id IS NOT NULL THEN
          EXECUTE format(
            'UPDATE public.store_tube_inventory_status SET %I = $1, last_updated_by_role = $2, last_updated_by = $3, last_updated_at = NOW(), last_updated_method = $4 WHERE id = $5',
            v_field
          )
          USING 
            CASE WHEN v_value = 'true' THEN true WHEN v_value = 'false' THEN false WHEN v_value = 'null' THEN NULL ELSE v_value::boolean END,
            v_submission.submitted_by_role,
            v_submission.submitted_by_user_id,
            v_update_method,
            v_submission.entity_id;
        ELSIF v_submission.action_type = 'update' THEN
          UPDATE public.store_tube_inventory
          SET current_tubes_left = COALESCE((v_submission.payload_after->>'quantity')::integer, current_tubes_left), last_updated = NOW()
          WHERE id = v_submission.entity_id;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.store_tube_inventory WHERE id = v_submission.entity_id;
        END IF;

      -- ═══ ORDER NOTE ═══
      WHEN 'order_note' THEN
        IF v_submission.action_type = 'create' THEN
          INSERT INTO public.order_notes (store_id, content, created_by)
          VALUES (v_submission.store_id, v_submission.payload_after->>'content', v_submission.submitted_by_user_id);
        ELSIF v_submission.action_type = 'update' THEN
          UPDATE public.order_notes SET content = v_submission.payload_after->>'content' WHERE id = v_submission.entity_id;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.order_notes WHERE id = v_submission.entity_id;
        END IF;

      -- ═══ STORE CONTACT (with all fields) ═══
      WHEN 'store_contact' THEN
        IF v_submission.action_type = 'create' THEN
          INSERT INTO public.store_contacts (store_id, name, phone, email, role, notes, shirt_size, responsive_by_call, responsive_by_text, created_by)
          VALUES (
            v_submission.store_id,
            v_submission.payload_after->>'name',
            v_submission.payload_after->>'phone',
            v_submission.payload_after->>'email',
            v_submission.payload_after->>'role',
            v_submission.payload_after->>'notes',
            v_submission.payload_after->>'shirt_size',
            COALESCE((v_submission.payload_after->>'responsive_by_call')::boolean, false),
            COALESCE((v_submission.payload_after->>'responsive_by_text')::boolean, false),
            v_submission.submitted_by_user_id
          );
        ELSIF v_submission.action_type = 'update' THEN
          UPDATE public.store_contacts SET
            name = COALESCE(v_submission.payload_after->>'name', name),
            phone = COALESCE(v_submission.payload_after->>'phone', phone),
            email = COALESCE(v_submission.payload_after->>'email', email),
            role = COALESCE(v_submission.payload_after->>'role', role),
            notes = COALESCE(v_submission.payload_after->>'notes', notes),
            shirt_size = COALESCE(v_submission.payload_after->>'shirt_size', shirt_size),
            responsive_by_call = COALESCE((v_submission.payload_after->>'responsive_by_call')::boolean, responsive_by_call),
            responsive_by_text = COALESCE((v_submission.payload_after->>'responsive_by_text')::boolean, responsive_by_text)
          WHERE id = v_submission.entity_id;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.store_contacts WHERE id = v_submission.entity_id;
        END IF;

      -- ═══ WHOLESALER ASSOCIATION ═══
      WHEN 'wholesaler_association' THEN
        IF v_submission.action_type = 'create' THEN
          v_new_wholesaler_id := (v_submission.payload_after->>'wholesaler_id')::uuid;
          IF v_new_wholesaler_id IS NOT NULL THEN
            INSERT INTO public.store_wholesaler_associations (store_id, wholesaler_id, created_by)
            VALUES (v_submission.store_id, v_new_wholesaler_id, v_submission.submitted_by_user_id)
            ON CONFLICT (store_id, wholesaler_id) DO NOTHING;
          END IF;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.store_wholesaler_associations WHERE id = v_submission.entity_id;
        END IF;

      -- ═══ CONNECTED STORE ═══
      WHEN 'connected_store' THEN
        IF v_submission.action_type = 'update' THEN
          v_group_id := (v_submission.payload_after->>'connected_store_group_id')::uuid;
          IF v_group_id IS NOT NULL THEN
            UPDATE public.store_master SET connected_store_group_id = v_group_id WHERE id = v_submission.store_id;
          END IF;
        END IF;

      -- ═══ STORE QUESTIONNAIRE ═══
      WHEN 'store_questionnaire' THEN
        IF v_submission.action_type = 'create' THEN
          INSERT INTO public.store_questionnaire (
            store_id, submitted_by, answers, brand_id
          ) VALUES (
            v_submission.store_id,
            v_submission.submitted_by_user_id,
            v_submission.payload_after::jsonb,
            (v_submission.payload_after->>'brand_id')::uuid
          );
        END IF;

      -- ═══ VISIT LOG ═══
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

      -- ═══ STORE UPDATE ═══
      WHEN 'store_update' THEN
        IF v_submission.action_type = 'update' AND v_submission.store_id IS NOT NULL THEN
          UPDATE public.store_master SET
            phone = COALESCE(v_submission.payload_after->>'phone', phone),
            owner_name = COALESCE(v_submission.payload_after->>'owner_name', owner_name),
            notes = COALESCE(v_submission.payload_after->>'notes', notes)
          WHERE id = v_submission.store_id;
        END IF;

      ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Unknown entity type: ' || v_submission.entity_type, 'errorCode', 'UNKNOWN_ENTITY');
    END CASE;

    -- Mark as applied
    UPDATE public.field_submissions
    SET is_applied = true, applied_at = NOW()
    WHERE id = p_submission_id;

    PERFORM set_config('app.governance_bypass', '', false);

    RETURN jsonb_build_object('success', true, 'entityType', v_submission.entity_type, 'actionType', v_submission.action_type);

  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.governance_bypass', '', false);
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'errorCode', SQLSTATE);
  END;
END;
$$;
