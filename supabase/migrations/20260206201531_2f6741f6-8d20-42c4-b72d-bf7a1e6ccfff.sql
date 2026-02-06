
-- Step 1: Add new entity types to field_entity_type enum
ALTER TYPE public.field_entity_type ADD VALUE IF NOT EXISTS 'store_contact';
ALTER TYPE public.field_entity_type ADD VALUE IF NOT EXISTS 'wholesaler_association';
ALTER TYPE public.field_entity_type ADD VALUE IF NOT EXISTS 'connected_store';
ALTER TYPE public.field_entity_type ADD VALUE IF NOT EXISTS 'store_questionnaire';

-- Step 2: Update apply_field_submission RPC to handle new entity types
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
  -- Fetch the submission
  SELECT * INTO v_submission
  FROM public.field_submissions
  WHERE id = p_submission_id;
  
  IF v_submission IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Submission not found',
      'errorCode', 'NOT_FOUND'
    );
  END IF;
  
  -- Verify status is approved
  IF v_submission.submission_status != 'approved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Submission is not approved',
      'errorCode', 'INVALID_STATUS',
      'currentStatus', v_submission.submission_status
    );
  END IF;
  
  -- Verify not already applied
  IF v_submission.is_applied THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Submission already applied',
      'errorCode', 'ALREADY_APPLIED'
    );
  END IF;
  
  -- Set governance bypass to allow mutations
  PERFORM set_config('app.governance_bypass', v_governance_bypass_key, false);
  
  -- Apply mutation based on entity_type
  BEGIN
    CASE v_submission.entity_type
      WHEN 'brand_sticker' THEN
        IF v_submission.action_type = 'update' THEN
          UPDATE public.store_brand_stickers
          SET 
            sticker_type = (v_submission.payload_after->>'sticker_type')::text,
            value = (v_submission.payload_after->>'value')::boolean,
            updated_at = NOW()
          WHERE id = v_submission.entity_id;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.store_brand_stickers
          WHERE id = v_submission.entity_id;
        END IF;
      
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
            CASE 
              WHEN v_value = 'true' THEN true
              WHEN v_value = 'false' THEN false
              WHEN v_value = 'null' THEN NULL
              ELSE v_value::boolean
            END,
            v_submission.submitted_by_role,
            v_submission.submitted_by_user_id,
            v_update_method,
            v_submission.entity_id;
        ELSIF v_submission.action_type = 'update' THEN
          UPDATE public.store_tube_inventory
          SET 
            current_tubes_left = COALESCE((v_submission.payload_after->>'quantity')::integer, current_tubes_left),
            last_updated = NOW()
          WHERE id = v_submission.entity_id;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.store_tube_inventory
          WHERE id = v_submission.entity_id;
        END IF;
      
      WHEN 'order_note' THEN
        IF v_submission.action_type = 'create' THEN
          INSERT INTO public.order_notes (store_id, content, created_by)
          VALUES (
            v_submission.store_id,
            v_submission.payload_after->>'content',
            v_submission.submitted_by_user_id
          );
        ELSIF v_submission.action_type = 'update' THEN
          UPDATE public.order_notes
          SET content = v_submission.payload_after->>'content'
          WHERE id = v_submission.entity_id;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.order_notes
          WHERE id = v_submission.entity_id;
        END IF;

      -- ═══════════════════════════════════════════════════════
      -- NEW: Store Contact governance
      -- ═══════════════════════════════════════════════════════
      WHEN 'store_contact' THEN
        IF v_submission.action_type = 'create' THEN
          INSERT INTO public.store_contacts (
            store_id, name, role, phone, 
            responsive_by_call, responsive_by_text, notes, shirt_size
          ) VALUES (
            v_submission.store_id,
            v_submission.payload_after->>'name',
            v_submission.payload_after->>'role',
            v_submission.payload_after->>'phone',
            COALESCE((v_submission.payload_after->>'responsive_by_call')::boolean, false),
            COALESCE((v_submission.payload_after->>'responsive_by_text')::boolean, false),
            v_submission.payload_after->>'notes',
            v_submission.payload_after->>'shirt_size'
          );
        ELSIF v_submission.action_type = 'update' THEN
          UPDATE public.store_contacts
          SET
            name = COALESCE(v_submission.payload_after->>'name', name),
            role = COALESCE(v_submission.payload_after->>'role', role),
            phone = COALESCE(v_submission.payload_after->>'phone', phone),
            responsive_by_call = COALESCE((v_submission.payload_after->>'responsive_by_call')::boolean, responsive_by_call),
            responsive_by_text = COALESCE((v_submission.payload_after->>'responsive_by_text')::boolean, responsive_by_text),
            notes = COALESCE(v_submission.payload_after->>'notes', notes),
            shirt_size = COALESCE(v_submission.payload_after->>'shirt_size', shirt_size)
          WHERE id = v_submission.entity_id;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.store_contacts
          WHERE id = v_submission.entity_id;
        END IF;

      -- ═══════════════════════════════════════════════════════
      -- NEW: Wholesaler Association governance
      -- ═══════════════════════════════════════════════════════
      WHEN 'wholesaler_association' THEN
        IF v_submission.action_type = 'create' THEN
          -- Check if this is a new wholesaler (has name in payload) or existing
          IF v_submission.payload_after->>'wholesaler_name' IS NOT NULL 
             AND v_submission.entity_id IS NULL THEN
            -- Create new global wholesaler first
            INSERT INTO public.wholesalers (name, address, city, state, phone, created_by)
            VALUES (
              v_submission.payload_after->>'wholesaler_name',
              v_submission.payload_after->>'wholesaler_address',
              v_submission.payload_after->>'wholesaler_city',
              v_submission.payload_after->>'wholesaler_state',
              v_submission.payload_after->>'wholesaler_phone',
              v_submission.submitted_by_user_id
            )
            RETURNING id INTO v_new_wholesaler_id;
            
            -- Create association
            INSERT INTO public.store_wholesaler_associations (store_id, wholesaler_id, created_by)
            VALUES (v_submission.store_id, v_new_wholesaler_id, v_submission.submitted_by_user_id)
            ON CONFLICT (store_id, wholesaler_id) DO NOTHING;
          ELSE
            -- Associate existing wholesaler
            INSERT INTO public.store_wholesaler_associations (store_id, wholesaler_id, created_by)
            VALUES (
              v_submission.store_id, 
              v_submission.entity_id, 
              v_submission.submitted_by_user_id
            )
            ON CONFLICT (store_id, wholesaler_id) DO NOTHING;
          END IF;
        ELSIF v_submission.action_type = 'delete' THEN
          DELETE FROM public.store_wholesaler_associations
          WHERE store_id = v_submission.store_id 
            AND wholesaler_id = v_submission.entity_id;
        END IF;

      -- ═══════════════════════════════════════════════════════
      -- NEW: Connected Store governance
      -- ═══════════════════════════════════════════════════════
      WHEN 'connected_store' THEN
        IF v_submission.action_type = 'create' THEN
          -- Get or create group ID for the parent store
          SELECT connected_group_id INTO v_group_id
          FROM public.store_master
          WHERE id = v_submission.store_id;
          
          IF v_group_id IS NULL THEN
            v_group_id := gen_random_uuid();
            UPDATE public.store_master
            SET connected_group_id = v_group_id
            WHERE id = v_submission.store_id;
          END IF;
          
          -- Create the connected store
          INSERT INTO public.store_master (
            store_name, address, city, state, zip, phone, connected_group_id
          ) VALUES (
            v_submission.payload_after->>'store_name',
            COALESCE(v_submission.payload_after->>'address', ''),
            COALESCE(v_submission.payload_after->>'city', ''),
            COALESCE(v_submission.payload_after->>'state', ''),
            COALESCE(v_submission.payload_after->>'zip', ''),
            COALESCE(v_submission.payload_after->>'phone', ''),
            v_group_id
          );
        END IF;

      -- ═══════════════════════════════════════════════════════
      -- NEW: Store Questionnaire governance
      -- ═══════════════════════════════════════════════════════
      WHEN 'store_questionnaire' THEN
        IF v_submission.action_type = 'update' OR v_submission.action_type = 'create' THEN
          INSERT INTO public.store_questionnaire (
            store_id, security_level, sells_flowers, interested_cleaning_service
          ) VALUES (
            v_submission.store_id,
            COALESCE(v_submission.payload_after->>'security_level', 'medium'),
            COALESCE((v_submission.payload_after->>'sells_flowers')::boolean, false),
            COALESCE((v_submission.payload_after->>'interested_cleaning_service')::boolean, false)
          )
          ON CONFLICT (store_id) DO UPDATE SET
            security_level = COALESCE(v_submission.payload_after->>'security_level', store_questionnaire.security_level),
            sells_flowers = COALESCE((v_submission.payload_after->>'sells_flowers')::boolean, store_questionnaire.sells_flowers),
            interested_cleaning_service = COALESCE((v_submission.payload_after->>'interested_cleaning_service')::boolean, store_questionnaire.interested_cleaning_service);
        END IF;
      
      ELSE
        RAISE EXCEPTION 'Unsupported entity_type: %', v_submission.entity_type;
    END CASE;
    
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.governance_bypass', '', false);
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
  END;
  
  -- Clear governance bypass
  PERFORM set_config('app.governance_bypass', '', false);
  
  -- Mark submission as applied
  UPDATE public.field_submissions
  SET 
    is_applied = true,
    updated_at = NOW()
  WHERE id = p_submission_id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'submissionId', p_submission_id,
    'applied_at', NOW()
  );
  
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.governance_bypass', '', false);
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'errorCode', SQLSTATE
  );
END;
$$;
