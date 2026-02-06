
-- Create apply_field_submission RPC
-- Applies an approved field submission to the appropriate production table
CREATE OR REPLACE FUNCTION public.apply_field_submission(
  p_submission_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_submission RECORD;
  v_result jsonb := '{}'::jsonb;
  v_governance_bypass_key text := 'authorized';
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
        IF v_submission.action_type = 'update' THEN
          UPDATE public.store_tube_inventory
          SET 
            tube_type = (v_submission.payload_after->>'tube_type')::text,
            quantity = (v_submission.payload_after->>'quantity')::integer,
            updated_at = NOW()
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
