-- 1) When an invite is accepted, also close sibling OPEN invites for the same
--    ambassador so a linked account can never be left showing "Invite pending".
CREATE OR REPLACE FUNCTION public.close_sibling_ambassador_invites()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.target_ambassador_id IS NOT NULL THEN

    UPDATE ambassador_invites i
    SET status = 'expired',
        used_at = COALESCE(i.used_at, now()),
        used_by_user_id = COALESCE(i.used_by_user_id, NEW.used_by_user_id),
        revoke_reason = COALESCE(i.revoke_reason, 'superseded_by_accepted_invite')
    WHERE i.target_ambassador_id = NEW.target_ambassador_id
      AND i.id <> NEW.id
      AND i.status = 'pending';

    INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
    SELECT i.id, 'expired', NEW.used_by_user_id,
           jsonb_build_object('reason', 'superseded_by_accepted_invite',
                              'accepted_invite_id', NEW.id,
                              'target_ambassador_id', NEW.target_ambassador_id)
    FROM ambassador_invites i
    WHERE i.target_ambassador_id = NEW.target_ambassador_id
      AND i.id <> NEW.id
      AND i.revoke_reason = 'superseded_by_accepted_invite'
      AND i.used_at >= now() - interval '1 minute';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_sibling_ambassador_invites ON public.ambassador_invites;
CREATE TRIGGER trg_close_sibling_ambassador_invites
AFTER UPDATE OF status ON public.ambassador_invites
FOR EACH ROW EXECUTE FUNCTION public.close_sibling_ambassador_invites();

-- 2) Admin reconciliation for ONE leftover open invite whose ambassador is
--    already linked to a login. Fails closed; never bulk-closes.
CREATE OR REPLACE FUNCTION public.close_ambassador_invite_for_linked_account(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_invite FROM ambassador_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found');
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite is not open');
  END IF;

  IF v_invite.target_ambassador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite is not bound to a specific ambassador');
  END IF;

  SELECT user_id INTO v_user FROM ambassadors WHERE id = v_invite.target_ambassador_id;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ambassador has no linked account');
  END IF;

  UPDATE ambassador_invites
  SET status = 'accepted', used_at = COALESCE(used_at, now()), used_by_user_id = COALESCE(used_by_user_id, v_user)
  WHERE id = p_invite_id;

  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
  VALUES (p_invite_id, 'accepted', auth.uid(),
    jsonb_build_object('reason', 'reconciled_existing_account_link',
                       'ambassador_id', v_invite.target_ambassador_id,
                       'linked_user_id', v_user));

  RETURN jsonb_build_object('success', true, 'invite_id', p_invite_id, 'linked_user_id', v_user);
END;
$$;

REVOKE ALL ON FUNCTION public.close_ambassador_invite_for_linked_account(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.close_ambassador_invite_for_linked_account(uuid) TO authenticated;