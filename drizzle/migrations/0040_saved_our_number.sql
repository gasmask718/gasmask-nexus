ALTER TABLE public.store_contacts
  ADD COLUMN IF NOT EXISTS saved_our_number boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saved_our_number_at timestamptz,
  ADD COLUMN IF NOT EXISTS saved_our_number_confirmed_by uuid REFERENCES public.ambassadors(id),
  ADD COLUMN IF NOT EXISTS saved_our_number_confirmed_by_user uuid,
  ADD COLUMN IF NOT EXISTS saved_our_number_source text;
COMMENT ON TABLE public.contact_saved_by IS 'DEPRECATED: owner corrected meaning; replaced by store_contacts.saved_our_number (store contact saved OUR number).';

CREATE OR REPLACE FUNCTION public.contact_mark_saved_our_number(p_contact_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s uuid; a uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT store_id INTO s FROM public.store_contacts WHERE id=p_contact_id AND deleted_at IS NULL;
  IF s IS NULL OR NOT public.contact_verification_can_access(s) THEN RAISE EXCEPTION 'Not authorized for this contact'; END IF;
  SELECT id INTO a FROM public.ambassadors WHERE user_id=auth.uid() AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  UPDATE public.store_contacts SET saved_our_number=true, saved_our_number_at=now(), saved_our_number_confirmed_by=a,
    saved_our_number_confirmed_by_user=auth.uid(), saved_our_number_source='in_person', updated_by=auth.uid()
  WHERE id=p_contact_id AND saved_our_number IS NOT TRUE;
  RETURN jsonb_build_object('saved', true);
END $$;
REVOKE ALL ON FUNCTION public.contact_mark_saved_our_number(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.contact_mark_saved_our_number(uuid) TO authenticated;

-- Inbound "SAVED" reply (service role only): marks contacts whose verification text came from that number
CREATE OR REPLACE FUNCTION public.contact_saved_our_number_receive(p_from text, p_to text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int;
BEGIN
  UPDATE public.store_contacts c SET saved_our_number=true, saved_our_number_at=now(), saved_our_number_source='text_reply'
  WHERE c.deleted_at IS NULL AND c.saved_our_number IS NOT TRUE
    AND right(regexp_replace(coalesce(c.phone,''),'\D','','g'),10)=right(regexp_replace(coalesce(p_from,''),'\D','','g'),10)
    AND right(regexp_replace(coalesce(c.verification_from_phone,''),'\D','','g'),10)=right(regexp_replace(coalesce(p_to,''),'\D','','g'),10)
    AND c.number_verification_sent_at IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('matched', n>0, 'updated', n);
END $$;
REVOKE ALL ON FUNCTION public.contact_saved_our_number_receive(text,text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.contact_saved_our_number_receive(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.contact_verification_contacts(p_store_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.contact_verification_can_access(p_store_id) THEN RAISE EXCEPTION 'Not authorized for this store'; END IF;
  RETURN jsonb_build_object('contacts',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'name',c.name,'role',c.role,'phone',c.phone,'status',c.number_verification_status,'sent_at',c.number_verification_sent_at,'delivered_at',c.number_verification_delivered_at,'confirmed_at',c.number_verification_confirmed_at,'failed_at',c.number_verification_failed_at,'error',c.number_verification_error,'method',c.verification_method,'override_reason',c.verification_override_reason,'override_at',c.verification_override_at,'auto_send',c.verification_auto_send_link,'link_status',c.portal_link_status,'link_error',c.portal_link_error,'link_attempt_at',c.portal_link_attempt_at,'opted_out',c.opted_out,'last_call_outcome',c.last_call_outcome,'total_calls_attempted',c.total_calls_attempted,'total_calls_answered',c.total_calls_answered,
    'line_type',c.line_type,'carrier',c.carrier,'line_checked_on',c.line_checked_on,'last_call_answered_at',c.last_call_answered_at,'total_texts_received',c.total_texts_received,'last_text_received_at',c.last_text_received_at,'can_receive_sms',c.can_receive_sms,
    'invite_sent_at',pi.created_at,'invite_opened_at',pi.metadata->>'opened_at','invite_consumed_at',pi.consumed_at,
    'saved_our_number',c.saved_our_number,'saved_our_number_at',c.saved_our_number_at,'saved_our_number_source',c.saved_our_number_source,'saved_our_number_by',(SELECT name FROM public.ambassadors WHERE id=c.saved_our_number_confirmed_by)
  ) ORDER BY c.is_primary DESC NULLS LAST,c.created_at),'[]'::jsonb)
  FROM public.store_contacts c LEFT JOIN public.portal_invites pi ON pi.id=c.portal_link_invite_id
  WHERE c.store_id=p_store_id AND c.deleted_at IS NULL),
  'store_name',(SELECT store_name FROM public.store_master WHERE id=p_store_id),'portal_live',public.store_portal_is_live(),'is_test',(SELECT is_portal_test FROM public.store_master WHERE id=p_store_id),'can_override',public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
END $$;

CREATE OR REPLACE FUNCTION public._contact_work_flags(p_store_ids uuid[], p_uid uuid)
RETURNS TABLE(store_id uuid, no_verified boolean, not_saved boolean, invite_not_sent boolean, invited_not_signed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT s.id,
    NOT EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.store_id=s.id AND c.deleted_at IS NULL AND c.number_verification_status='confirmed' AND coalesce(c.opted_out,false)=false),
    EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.store_id=s.id AND c.deleted_at IS NULL AND c.phone IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.store_id=s.id AND c.deleted_at IS NULL AND c.saved_our_number),
    EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.store_id=s.id AND c.deleted_at IS NULL AND c.number_verification_status='confirmed' AND coalesce(c.opted_out,false)=false AND lower(coalesce(c.role,'')) IN ('owner','manager'))
      AND NOT EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.store_id=s.id AND c.deleted_at IS NULL AND (c.portal_link_invite_id IS NOT NULL OR c.portal_link_status IN ('sending','sent','queued'))),
    EXISTS (SELECT 1 FROM public.store_contacts c JOIN public.portal_invites pi ON pi.id=c.portal_link_invite_id WHERE c.store_id=s.id AND c.deleted_at IS NULL AND pi.consumed_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM public.store_users su WHERE su.store_id=s.id)
  FROM unnest(p_store_ids) AS s(id)
$$;

CREATE OR REPLACE FUNCTION public.contact_status_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Owner/admin only'; END IF;
  RETURN (SELECT jsonb_build_object(
    'contacts', count(*),
    'verified', count(*) FILTER (WHERE c.number_verification_status='confirmed' AND coalesce(c.opted_out,false)=false),
    'saved', count(*) FILTER (WHERE c.saved_our_number),
    'invites_sent', count(*) FILTER (WHERE c.portal_link_invite_id IS NOT NULL OR c.portal_link_status IN ('sending','sent','queued')),
    'accounts_created', (SELECT count(*) FROM public.store_users su JOIN public.store_master sm ON sm.id=su.store_id WHERE coalesce(sm.is_portal_test,false)=false))
  FROM public.store_contacts c JOIN public.store_master sm ON sm.id=c.store_id
  WHERE c.deleted_at IS NULL AND c.phone IS NOT NULL AND coalesce(c.is_simulation,false)=false AND sm.deleted_at IS NULL AND coalesce(sm.is_portal_test,false)=false);
END $$;