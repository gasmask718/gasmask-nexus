CREATE OR REPLACE FUNCTION public.review_ambassador_invite_request(p_request_id uuid, p_decision text, p_notes text DEFAULT NULL::text, p_show_notes boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_req RECORD;
  v_token TEXT;
  v_invite_id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT * INTO v_req FROM ambassador_invite_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_reviewed');
  END IF;

  IF p_decision = 'decline' THEN
    IF p_notes IS NULL OR length(trim(p_notes)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'reason_required');
    END IF;
    UPDATE ambassador_invite_requests
    SET status = 'rejected', reviewed_by = auth.uid(), review_notes = p_notes,
        show_review_notes = p_show_notes, updated_at = now()
    WHERE id = v_req.id;
    RETURN jsonb_build_object('success', true, 'decision', 'declined');
  END IF;

  IF p_decision <> 'approve' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_decision');
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO ambassador_invites (
    invited_by_ambassador_id, invited_by_user_id, invite_token, token_hash,
    email, phone, owner_approved_at, owner_approved_by
  ) VALUES (
    v_req.requested_by_ambassador_id, v_req.requested_by, v_token,
    encode(digest(v_token, 'sha256'), 'hex'),
    v_req.email, v_req.phone, now(), auth.uid()
  )
  RETURNING id INTO v_invite_id;

  UPDATE ambassador_invite_requests
  SET status = 'approved', reviewed_by = auth.uid(), review_notes = p_notes,
      show_review_notes = p_show_notes, generated_invite_id = v_invite_id, updated_at = now()
  WHERE id = v_req.id;

  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata) VALUES
    (v_invite_id, 'created', auth.uid(), jsonb_build_object('request_id', v_req.id, 'source', v_req.source)),
    (v_invite_id, 'approved', auth.uid(), jsonb_build_object('request_id', v_req.id, 'approval_kind', 'owner_approved'));

  RETURN jsonb_build_object(
    'success', true,
    'decision', 'approved',
    'invite_id', v_invite_id,
    'token', v_token
  );
END;
$function$;