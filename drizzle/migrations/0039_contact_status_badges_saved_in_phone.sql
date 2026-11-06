CREATE TABLE IF NOT EXISTS public.contact_saved_by (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.store_contacts(id),
  ambassador_id uuid REFERENCES public.ambassadors(id),
  user_id uuid NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_saved_by_contact_user_key UNIQUE (contact_id, user_id)
);
CREATE INDEX IF NOT EXISTS contact_saved_by_user_idx ON public.contact_saved_by(user_id);
GRANT SELECT ON public.contact_saved_by TO authenticated;
GRANT ALL ON public.contact_saved_by TO service_role;
ALTER TABLE public.contact_saved_by ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See saves for stores you can access" ON public.contact_saved_by FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.id = contact_id AND public.contact_verification_can_access(c.store_id)));

CREATE OR REPLACE FUNCTION public.contact_mark_saved(p_contact_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s uuid; a uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT store_id INTO s FROM public.store_contacts WHERE id=p_contact_id AND deleted_at IS NULL;
  IF s IS NULL OR NOT public.contact_verification_can_access(s) THEN RAISE EXCEPTION 'Not authorized for this contact'; END IF;
  SELECT id INTO a FROM public.ambassadors WHERE user_id=auth.uid() AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  INSERT INTO public.contact_saved_by(contact_id, ambassador_id, user_id) VALUES (p_contact_id, a, auth.uid())
  ON CONFLICT (contact_id, user_id) DO NOTHING;
  RETURN jsonb_build_object('saved', true);
END $$;
REVOKE ALL ON FUNCTION public.contact_mark_saved(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.contact_mark_saved(uuid) TO authenticated;

-- Same contract as before, plus status-badge fields (additive keys only)
CREATE OR REPLACE FUNCTION public.contact_verification_contacts(p_store_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.contact_verification_can_access(p_store_id) THEN RAISE EXCEPTION 'Not authorized for this store'; END IF;
  RETURN jsonb_build_object('contacts',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'name',c.name,'role',c.role,'phone',c.phone,'status',c.number_verification_status,'sent_at',c.number_verification_sent_at,'delivered_at',c.number_verification_delivered_at,'confirmed_at',c.number_verification_confirmed_at,'failed_at',c.number_verification_failed_at,'error',c.number_verification_error,'method',c.verification_method,'override_reason',c.verification_override_reason,'override_at',c.verification_override_at,'auto_send',c.verification_auto_send_link,'link_status',c.portal_link_status,'link_error',c.portal_link_error,'link_attempt_at',c.portal_link_attempt_at,'opted_out',c.opted_out,'last_call_outcome',c.last_call_outcome,'total_calls_attempted',c.total_calls_attempted,'total_calls_answered',c.total_calls_answered,
    'line_type',c.line_type,'carrier',c.carrier,'line_checked_on',c.line_checked_on,'last_call_answered_at',c.last_call_answered_at,'total_texts_received',c.total_texts_received,'last_text_received_at',c.last_text_received_at,'can_receive_sms',c.can_receive_sms,
    'invite_sent_at',pi.created_at,'invite_opened_at',pi.metadata->>'opened_at','invite_consumed_at',pi.consumed_at,
    'saved_by',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',coalesce(a.name,'Staff'),'saved_at',sb.saved_at,'me',sb.user_id=auth.uid()) ORDER BY sb.saved_at),'[]'::jsonb) FROM public.contact_saved_by sb LEFT JOIN public.ambassadors a ON a.id=sb.ambassador_id WHERE sb.contact_id=c.id)
  ) ORDER BY c.is_primary DESC NULLS LAST,c.created_at),'[]'::jsonb)
  FROM public.store_contacts c LEFT JOIN public.portal_invites pi ON pi.id=c.portal_link_invite_id
  WHERE c.store_id=p_store_id AND c.deleted_at IS NULL),
  'store_name',(SELECT store_name FROM public.store_master WHERE id=p_store_id),'portal_live',public.store_portal_is_live(),'is_test',(SELECT is_portal_test FROM public.store_master WHERE id=p_store_id),'can_override',public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
END $$;
REVOKE ALL ON FUNCTION public.contact_verification_contacts(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.contact_verification_contacts(uuid) TO authenticated;

-- Per-store contact work flags (internal)
CREATE OR REPLACE FUNCTION public._contact_work_flags(p_store_ids uuid[], p_uid uuid)
RETURNS TABLE(store_id uuid, no_verified boolean, not_saved boolean, invite_not_sent boolean, invited_not_signed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT s.id,
    NOT EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.store_id=s.id AND c.deleted_at IS NULL AND c.number_verification_status='confirmed' AND coalesce(c.opted_out,false)=false),
    EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.store_id=s.id AND c.deleted_at IS NULL AND c.phone IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.store_contacts c JOIN public.contact_saved_by sb ON sb.contact_id=c.id AND sb.user_id=p_uid WHERE c.store_id=s.id AND c.deleted_at IS NULL),
    EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.store_id=s.id AND c.deleted_at IS NULL AND c.number_verification_status='confirmed' AND coalesce(c.opted_out,false)=false AND lower(coalesce(c.role,'')) IN ('owner','manager'))
      AND NOT EXISTS (SELECT 1 FROM public.store_contacts c WHERE c.store_id=s.id AND c.deleted_at IS NULL AND (c.portal_link_invite_id IS NOT NULL OR c.portal_link_status IN ('sending','sent','queued'))),
    EXISTS (SELECT 1 FROM public.store_contacts c JOIN public.portal_invites pi ON pi.id=c.portal_link_invite_id WHERE c.store_id=s.id AND c.deleted_at IS NULL AND pi.consumed_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM public.store_users su WHERE su.store_id=s.id)
  FROM unnest(p_store_ids) AS s(id)
$$;
REVOKE ALL ON FUNCTION public._contact_work_flags(uuid[],uuid) FROM PUBLIC, anon, authenticated;

-- Store list filter: returns only the accessible store ids that match
CREATE OR REPLACE FUNCTION public.contact_work_filter(p_store_ids uuid[], p_filter text)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_filter NOT IN ('no_verified','not_saved','invite_not_sent','invited_not_signed') THEN RAISE EXCEPTION 'Unknown filter'; END IF;
  IF coalesce(array_length(p_store_ids,1),0) > 5000 THEN RAISE EXCEPTION 'Too many stores'; END IF;
  SELECT coalesce(array_agg(f.store_id),'{}') INTO r FROM public._contact_work_flags(p_store_ids, auth.uid()) f
  WHERE public.contact_verification_can_access(f.store_id)
    AND CASE p_filter WHEN 'no_verified' THEN f.no_verified WHEN 'not_saved' THEN f.not_saved WHEN 'invite_not_sent' THEN f.invite_not_sent ELSE f.invited_not_signed END;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.contact_work_filter(uuid[],text) TO authenticated;

-- My Work list: the ambassador's own stores matching a contact filter
CREATE OR REPLACE FUNCTION public.contact_work_list(p_ambassador_id uuid, p_filter text, p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid; ids uuid[]; out jsonb;
BEGIN
  v_uid := public._ambassador_work_access(p_ambassador_id);
  IF p_filter NOT IN ('no_verified','not_saved','invite_not_sent','invited_not_signed') THEN RAISE EXCEPTION 'Unknown filter'; END IF;
  SELECT array_agg(id) INTO ids FROM public.store_master sm WHERE sm.deleted_at IS NULL AND (sm.confirmed_by_ambassador_id=p_ambassador_id OR sm.assigned_ambassador_id=p_ambassador_id OR sm.sourced_by_ambassador_id=p_ambassador_id);
  SELECT coalesce(jsonb_agg(x ORDER BY x.store_name),'[]') INTO out FROM (
    SELECT sm.id AS store_id, sm.store_name, concat_ws(', ', sm.address, sm.city) AS store_address, sm.phone
    FROM public._contact_work_flags(coalesce(ids,'{}'), coalesce(v_uid, auth.uid())) f JOIN public.store_master sm ON sm.id=f.store_id
    WHERE CASE p_filter WHEN 'no_verified' THEN f.no_verified WHEN 'not_saved' THEN f.not_saved WHEN 'invite_not_sent' THEN f.invite_not_sent ELSE f.invited_not_signed END
    ORDER BY sm.store_name LIMIT least(greatest(coalesce(p_limit,100),1),500)) x;
  RETURN jsonb_build_object('stores', out, 'total_stores', coalesce(array_length(ids,1),0));
END $$;
GRANT EXECUTE ON FUNCTION public.contact_work_list(uuid,text,int) TO authenticated;

-- Owner tile
CREATE OR REPLACE FUNCTION public.contact_status_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Owner/admin only'; END IF;
  RETURN (SELECT jsonb_build_object(
    'contacts', count(*),
    'verified', count(*) FILTER (WHERE c.number_verification_status='confirmed' AND coalesce(c.opted_out,false)=false),
    'saved', count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.contact_saved_by sb WHERE sb.contact_id=c.id)),
    'invites_sent', count(*) FILTER (WHERE c.portal_link_invite_id IS NOT NULL OR c.portal_link_status IN ('sending','sent','queued')),
    'accounts_created', (SELECT count(*) FROM public.store_users su JOIN public.store_master sm ON sm.id=su.store_id WHERE coalesce(sm.is_portal_test,false)=false))
  FROM public.store_contacts c JOIN public.store_master sm ON sm.id=c.store_id
  WHERE c.deleted_at IS NULL AND c.phone IS NOT NULL AND coalesce(c.is_simulation,false)=false AND sm.deleted_at IS NULL AND coalesce(sm.is_portal_test,false)=false);
END $$;
GRANT EXECUTE ON FUNCTION public.contact_status_overview() TO authenticated;