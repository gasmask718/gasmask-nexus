CREATE OR REPLACE FUNCTION public._ambassador_work_access(p_ambassador_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_amb public.ambassadors%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v_amb FROM public.ambassadors WHERE id=p_ambassador_id AND deleted_at IS NULL;
  IF v_amb.id IS NULL THEN RAISE EXCEPTION 'Ambassador not found'; END IF;
  IF NOT ((v_amb.user_id IS NOT NULL AND v_amb.user_id = v_uid) OR public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'owner'::public.app_role)) THEN
    RAISE EXCEPTION 'You can only view your own work';
  END IF;
  RETURN v_amb.user_id;
END $$;
REVOKE ALL ON FUNCTION public._ambassador_work_access(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ambassador_activity_day(p_ambassador_id uuid, p_day date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_amb public.ambassadors%ROWTYPE; v_uid uuid := auth.uid(); v_is_staff boolean; v_events jsonb; v_people jsonb; v_summary jsonb;
BEGIN
  SELECT * INTO v_amb FROM public.ambassadors WHERE id=p_ambassador_id AND deleted_at IS NULL;
  IF v_amb.id IS NULL THEN RAISE EXCEPTION 'Ambassador not found'; END IF;
  v_is_staff := public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'owner'::public.app_role) OR public.has_role(v_uid,'staff'::public.app_role) OR public.has_role(v_uid,'va'::public.app_role);
  IF NOT (coalesce(v_is_staff,false) OR (v_amb.user_id IS NOT NULL AND v_amb.user_id = v_uid)) THEN RAISE EXCEPTION 'You can only view your own activity'; END IF;
  WITH touched_stores AS (
    SELECT DISTINCT store_id FROM (
      SELECT sv.store_id, sv.started_at AS at FROM public.store_visits sv WHERE sv.visited_by=v_amb.user_id
      UNION ALL SELECT sn.store_id, sn.created_at FROM public.store_notes sn WHERE sn.created_by=v_amb.user_id OR sn.ambassador_id=v_amb.id
      UNION ALL SELECT fs.store_id, fs.created_at FROM public.field_submissions fs WHERE fs.submitted_by_user_id=v_amb.user_id
      UNION ALL SELECT cl.store_id, cl.created_at FROM public.change_lists cl WHERE cl.submitted_by=v_amb.user_id AND cl.submitted_by_role='ambassador'
      UNION ALL SELECT st.store_id, st.last_updated_at FROM public.store_tube_inventory_status st WHERE st.last_updated_by=v_amb.user_id AND st.is_simulation IS FALSE
      UNION ALL SELECT i.store_id, i.created_at FROM public.invoices i WHERE i.recorded_by_user_id=v_amb.user_id OR i.paid_by_user_id=v_amb.user_id
      UNION ALL SELECT c.store_id, c.created_at FROM public.communication_logs c WHERE c.ambassador_id=v_amb.id OR c.created_by=v_amb.user_id
    ) s WHERE store_id IS NOT NULL AND (at AT TIME ZONE 'America/New_York')::date = p_day
  ), ev AS (
    SELECT 'visit'::text AS type, sv.started_at AS at, sv.store_id, coalesce(sv.visit_type,'visit')||CASE WHEN sv.status IS NOT NULL THEN ' ('||sv.status||')' ELSE '' END AS detail FROM public.store_visits sv WHERE sv.visited_by=v_amb.user_id AND (sv.started_at AT TIME ZONE 'America/New_York')::date=p_day
    UNION ALL SELECT 'note', sn.created_at, sn.store_id, left(sn.note_text,200) FROM public.store_notes sn WHERE (sn.created_by=v_amb.user_id OR sn.ambassador_id=v_amb.id) AND (sn.created_at AT TIME ZONE 'America/New_York')::date=p_day
    UNION ALL SELECT 'field_change', fs.created_at, fs.store_id, fs.entity_type::text||' / '||fs.action_type::text||' ('||fs.submission_status::text||')' FROM public.field_submissions fs WHERE fs.submitted_by_user_id=v_amb.user_id AND (fs.created_at AT TIME ZONE 'America/New_York')::date=p_day
    UNION ALL SELECT 'change_request', cl.created_at, cl.store_id, 'Change list ('||cl.status||')' FROM public.change_lists cl WHERE cl.submitted_by=v_amb.user_id AND cl.submitted_by_role='ambassador' AND (cl.created_at AT TIME ZONE 'America/New_York')::date=p_day
    UNION ALL SELECT 'inventory_count', st.last_updated_at, st.store_id, st.brand_name||': '||coalesce(st.current_tubes_left,0)||' left' FROM public.store_tube_inventory_status st WHERE st.last_updated_by=v_amb.user_id AND st.is_simulation IS FALSE AND (st.last_updated_at AT TIME ZONE 'America/New_York')::date=p_day
    UNION ALL SELECT 'order', i.created_at, i.store_id, 'Invoice '||coalesce(i.invoice_number,'')||' $'||coalesce(i.total_amount,0) FROM public.invoices i WHERE i.recorded_by_user_id=v_amb.user_id AND (i.created_at AT TIME ZONE 'America/New_York')::date=p_day AND i.deleted_at IS NULL
    UNION ALL SELECT 'payment', coalesce(i.paid_at,i.created_at), i.store_id, 'Payment $'||coalesce(i.amount_paid,0)||' ('||coalesce(i.payment_method,'?')||')' FROM public.invoices i WHERE i.paid_by_user_id=v_amb.user_id AND (coalesce(i.paid_at,i.created_at) AT TIME ZONE 'America/New_York')::date=p_day AND i.deleted_at IS NULL AND i.amount_paid>0
    UNION ALL SELECT CASE WHEN sp.prospect_status='Promoted' THEN 'prospect_promoted' ELSE 'prospect_not_interested' END, sp.promoted_at, sp.promoted_store_id, coalesce(sp.store_name,'')||' – '||coalesce(sp.prospect_status,'') FROM public.store_prospects sp WHERE sp.promoted_by=v_amb.user_id AND sp.promoted_at IS NOT NULL AND (sp.promoted_at AT TIME ZONE 'America/New_York')::date=p_day
    UNION ALL SELECT 'new_store', sm.sourced_at, sm.id, 'Added store' FROM public.store_master sm WHERE sm.sourced_by_ambassador_id=v_amb.id AND sm.sourced_at IS NOT NULL AND (sm.sourced_at AT TIME ZONE 'America/New_York')::date=p_day AND sm.deleted_at IS NULL
    UNION ALL SELECT 'call_text', c.created_at, c.store_id, coalesce(c.channel,'comm')||' '||coalesce(c.direction,'')||' '||coalesce(left(c.summary,120),'') FROM public.communication_logs c WHERE (c.ambassador_id=v_amb.id OR c.created_by=v_amb.user_id) AND (c.created_at AT TIME ZONE 'America/New_York')::date=p_day
    UNION ALL SELECT 'voice_update', vn.confirmed_at, vn.store_id, left(coalesce(vn.summary,'Voice update')||E'\nTranscript: '||coalesce(vn.transcript,'')||E'\nSaved: '||coalesce(vn.saved_result::text,'{}'),4000) FROM public.store_voice_notes vn WHERE vn.created_by=v_amb.user_id AND vn.status='confirmed' AND (vn.confirmed_at AT TIME ZONE 'America/New_York')::date=p_day
  ), evj AS (
    SELECT e.type, e.at, e.store_id, e.detail, sm.store_name, concat_ws(', ', sm.address, sm.city, sm.state) AS store_address FROM ev e LEFT JOIN public.store_master sm ON sm.id=e.store_id ORDER BY e.at DESC
  )
  SELECT coalesce(jsonb_agg(to_jsonb(evj)),'[]'::jsonb) INTO v_events FROM evj;
  SELECT coalesce(jsonb_agg(to_jsonb(ppl) ORDER BY ppl.store_name, ppl.name),'[]'::jsonb) INTO v_people FROM (SELECT DISTINCT sc.name, sc.role, sc.phone, sm2.store_name FROM public.store_contacts sc JOIN touched_stores ts ON ts.store_id=sc.store_id JOIN public.store_master sm2 ON sm2.id=sc.store_id WHERE sc.deleted_at IS NULL AND nullif(btrim(coalesce(sc.name,'')),'') IS NOT NULL) ppl;
  SELECT jsonb_build_object('stores_visited',(SELECT count(DISTINCT store_id) FROM evj WHERE type='visit'),'new_stores',(SELECT count(*) FROM evj WHERE type IN ('new_store','prospect_promoted')),'orders_count',(SELECT count(*) FROM evj WHERE type='order'),'orders_total',(SELECT coalesce(sum(i.total_amount),0) FROM public.invoices i WHERE i.recorded_by_user_id=v_amb.user_id AND (i.created_at AT TIME ZONE 'America/New_York')::date=p_day AND i.deleted_at IS NULL),'payments_total',(SELECT coalesce(sum(i.amount_paid),0) FROM public.invoices i WHERE i.paid_by_user_id=v_amb.user_id AND (coalesce(i.paid_at,i.created_at) AT TIME ZONE 'America/New_York')::date=p_day AND i.deleted_at IS NULL),'notes_count',(SELECT count(*) FROM evj WHERE type='note'),'voice_updates_count',(SELECT count(*) FROM evj WHERE type='voice_update')) INTO v_summary;
  RETURN jsonb_build_object('day',p_day,'ambassador_id',v_amb.id,'ambassador_name',v_amb.name,'summary',v_summary,'events',v_events,'people',v_people);
END $function$;
GRANT EXECUTE ON FUNCTION public.ambassador_activity_day(uuid,date) TO authenticated;