
-- Add last_updated_method column to store_tube_inventory_status
ALTER TABLE public.store_tube_inventory_status
ADD COLUMN IF NOT EXISTS last_updated_method text;

-- Add a comment documenting allowed values
COMMENT ON COLUMN public.store_tube_inventory_status.last_updated_method IS 'Update method: in_person, call, text, system. Required on every update.';

-- Update the apply_field_submission RPC to handle tube_inventory signals on store_tube_inventory_status
-- and propagate the update_method from payload_after
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
        -- Extract field/value from payload_after for signal updates
        v_field := v_submission.payload_after->>'field';
        v_value := v_submission.payload_after->>'value';
        v_update_method := COALESCE(v_submission.payload_after->>'update_method', 'system');
        
        IF v_field IS NOT NULL AND v_submission.entity_id IS NOT NULL THEN
          -- Signal field update on store_tube_inventory_status
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
          -- Legacy tube_inventory count update
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
      
      ELSE
        RAISE EXCEPTION 'Unsupported entity_type: %', v_submission.entity_type;
    END CASE;
    
  EXCEPTION WHEN OTHERS THEN
    -- Clear bypass
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
