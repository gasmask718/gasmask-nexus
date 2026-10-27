-- A) Territory fix: city/custom_zone/county matches also require the prospect state to match the ambassador's state (when set)
CREATE OR REPLACE FUNCTION public.ambassador_area_prospect_keys()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.prospect_key FROM public.ambassadors a
  JOIN public.ambassador_territory_coverage tc ON tc.ambassador_id=a.id
  JOIN public.store_prospects p ON CASE tc.region_type::text
  WHEN 'state' THEN nullif(public.normalize_us_state(tc.region_value),'') = nullif(public.normalize_us_state(p.state),'')
  WHEN 'city' THEN (lower(tc.region_value)=lower(p.borough_or_county) OR lower(tc.region_value)=lower(p.neighborhood))
    AND (nullif(btrim(coalesce(a.state,'')),'') IS NULL OR public.normalize_us_state(p.state)=public.normalize_us_state(a.state))
  WHEN 'custom_zone' THEN (lower(tc.region_value)=lower(p.borough_or_county) OR lower(tc.region_value)=lower(p.neighborhood))
    AND (nullif(btrim(coalesce(a.state,'')),'') IS NULL OR public.normalize_us_state(p.state)=public.normalize_us_state(a.state))
  WHEN 'zip' THEN substring(regexp_replace(tc.region_value,'[^0-9]','','g') from 1 for 5)=substring(regexp_replace(p.zip,'[^0-9]','','g') from 1 for 5) AND length(regexp_replace(tc.region_value,'[^0-9]','','g'))>=5 AND length(regexp_replace(p.zip,'[^0-9]','','g'))>=5
  WHEN 'county' THEN lower(tc.region_value)=lower(p.borough_or_county)
    AND (nullif(btrim(coalesce(a.state,'')),'') IS NULL OR public.normalize_us_state(p.state)=public.normalize_us_state(a.state))
  ELSE false END
  WHERE a.user_id=auth.uid() AND a.is_active IS TRUE AND a.deleted_at IS NULL
  AND public.has_role(auth.uid(),'ambassador'::public.app_role) AND nullif(tc.region_value,'') IS NOT NULL
$function$;

-- B) Attribution columns (additive, going forward only; no backfill)
ALTER TABLE public.store_prospects ADD COLUMN IF NOT EXISTS promoted_by uuid;
ALTER TABLE public.store_prospects ADD COLUMN IF NOT EXISTS ambassador_action_note text;
ALTER TABLE public.store_master ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recorded_by_user_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_by_user_id uuid;
COMMENT ON COLUMN public.invoices.recorded_by_user_id IS 'Attribution going forward: auth user who created the invoice (stamped by trigger, never backfilled).';
COMMENT ON COLUMN public.invoices.paid_by_user_id IS 'Attribution going forward: auth user who last recorded a payment (stamped by trigger, never backfilled).';

CREATE OR REPLACE FUNCTION public.trg_invoices_stamp_attribution()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.recorded_by_user_id IS NULL THEN NEW.recorded_by_user_id := auth.uid(); END IF;
  ELSIF TG_OP='UPDATE' THEN
    IF (NEW.amount_paid IS DISTINCT FROM OLD.amount_paid OR NEW.payment_status IS DISTINCT FROM OLD.payment_status)
       AND auth.uid() IS NOT NULL THEN
      NEW.paid_by_user_id := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS trg_invoices_stamp_attribution ON public.invoices;
CREATE TRIGGER trg_invoices_stamp_attribution BEFORE INSERT OR UPDATE OF amount_paid, payment_status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_invoices_stamp_attribution();

-- B) Promote / not-interested RPC
CREATE OR REPLACE FUNCTION public.ambassador_promote_prospect(p_prospect_key text, p_visit_note text DEFAULT NULL, p_outcome text DEFAULT 'promoted')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_amb public.ambassadors%ROWTYPE;
  v_p public.store_prospects%ROWTYPE;
  v_existing uuid;
  v_store_id uuid;
  v_note text := nullif(btrim(coalesce(p_visit_note,'')),' ');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'ambassador'::public.app_role) THEN
    RAISE EXCEPTION 'Only active ambassadors can promote prospects';
  END IF;
  SELECT * INTO v_amb FROM public.ambassadors WHERE user_id=auth.uid() AND is_active IS TRUE AND deleted_at IS NULL LIMIT 1;
  IF v_amb.id IS NULL THEN RAISE EXCEPTION 'No active ambassador profile for this account'; END IF;
  IF p_outcome NOT IN ('promoted','not_interested') THEN RAISE EXCEPTION 'Invalid outcome: %', p_outcome; END IF;
  SELECT * INTO v_p FROM public.store_prospects WHERE prospect_key=p_prospect_key;
  IF v_p.prospect_key IS NULL THEN RAISE EXCEPTION 'Prospect not found'; END IF;
  IF v_p.promoted_store_id IS NOT NULL THEN RAISE EXCEPTION 'Prospect already promoted'; END IF;
  IF NOT (v_p.prospect_key IN (SELECT public.ambassador_area_prospect_keys())) THEN
    RAISE EXCEPTION 'Prospect is outside your territory';
  END IF;

  IF p_outcome='not_interested' THEN
    UPDATE public.store_prospects SET prospect_status='Visited – not interested', promoted_at=now(), promoted_by=auth.uid(), ambassador_action_note=v_note
    WHERE prospect_key=p_prospect_key;
    RETURN jsonb_build_object('status','not_interested','prospect_key',p_prospect_key);
  END IF;

  -- Duplicate guard: non-merged store at same normalized address + zip
  SELECT sm.id INTO v_existing FROM public.store_master sm
  WHERE sm.deleted_at IS NULL AND coalesce(sm.is_simulation,false) IS FALSE
    AND substring(regexp_replace(coalesce(sm.zip,''),'[^0-9]','','g') from 1 for 5)=substring(regexp_replace(coalesce(v_p.zip,''),'[^0-9]','','g') from 1 for 5)
    AND nullif(regexp_replace(coalesce(v_p.zip,''),'[^0-9]','','g'),'') IS NOT NULL
    AND public.addr_key(sm.address)=public.addr_key(v_p.address)
    AND public.addr_key(v_p.address) <> ''
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.store_master SET assigned_ambassador_id=coalesce(assigned_ambassador_id, v_amb.id), last_visit_at=now(), updated_by=auth.uid()
    WHERE id=v_existing;
    UPDATE public.store_prospects SET prospect_status='Promoted', promoted_store_id=v_existing, promoted_at=now(), promoted_by=auth.uid(), ambassador_action_note=v_note
    WHERE prospect_key=p_prospect_key;
    IF v_note IS NOT NULL THEN
      INSERT INTO public.store_notes(store_id, note_text, created_by, ambassador_id, source) VALUES (v_existing, v_note, auth.uid(), v_amb.id, 'ambassador_prospect');
    END IF;
    RETURN jsonb_build_object('status','linked_existing','store_id',v_existing,'prospect_key',p_prospect_key);
  END IF;

  INSERT INTO public.store_master(store_name,address,city,state,zip,phone,store_type,neighborhood,borough,lat,lon,
    assigned_ambassador_id,sourced_by_ambassador_id,sourced_at,last_visit_at,source,business_id,status,updated_by)
  VALUES (coalesce(nullif(btrim(v_p.store_name),''),'Unnamed store'),v_p.address,v_p.city,v_p.state,v_p.zip,v_p.phone,v_p.store_type,v_p.neighborhood,v_p.borough_or_county,v_p.lat,v_p.lon,
    v_amb.id,v_amb.id,now(),now(),'ambassador_prospect','c3d4e5f6-a7b8-9012-cdef-123456789012','active',auth.uid())
  RETURNING id INTO v_store_id;

  UPDATE public.store_prospects SET prospect_status='Promoted', promoted_store_id=v_store_id, promoted_at=now(), promoted_by=auth.uid(), ambassador_action_note=v_note
  WHERE prospect_key=p_prospect_key;
  IF v_note IS NOT NULL THEN
    INSERT INTO public.store_notes(store_id, note_text, created_by, ambassador_id, source) VALUES (v_store_id, v_note, auth.uid(), v_amb.id, 'ambassador_prospect');
  END IF;
  RETURN jsonb_build_object('status','created','store_id',v_store_id,'prospect_key',p_prospect_key);
END
$function$;
GRANT EXECUTE ON FUNCTION public.ambassador_promote_prospect(text,text,text) TO authenticated;

-- C) Per-ambassador day activity (own data for ambassadors; admin/owner/staff/va may view any)
CREATE OR REPLACE FUNCTION public.ambassador_activity_day(p_ambassador_id uuid, p_day date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_amb public.ambassadors%ROWTYPE;
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_events jsonb;
  v_people jsonb;
  v_summary jsonb;
BEGIN
  SELECT * INTO v_amb FROM public.ambassadors WHERE id=p_ambassador_id AND deleted_at IS NULL;
  IF v_amb.id IS NULL THEN RAISE EXCEPTION 'Ambassador not found'; END IF;
  v_is_staff := public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'owner'::public.app_role)
    OR public.has_role(v_uid,'staff'::public.app_role) OR public.has_role(v_uid,'va'::public.app_role);
  IF NOT (v_is_staff OR v_amb.user_id = v_uid) THEN
    RAISE EXCEPTION 'You can only view your own activity';
  END IF;

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
  ), evj AS (
    SELECT e.type, e.at, e.store_id, e.detail, sm.store_name, concat_ws(', ', sm.address, sm.city, sm.state) AS store_address
    FROM ev e LEFT JOIN public.store_master sm ON sm.id=e.store_id
    ORDER BY e.at DESC
  )
  SELECT coalesce(jsonb_agg(to_jsonb(evj)),'[]'::jsonb) INTO v_events FROM evj;

  SELECT coalesce(jsonb_agg(to_jsonb(ppl) ORDER BY ppl.store_name, ppl.name),'[]'::jsonb) INTO v_people
  FROM (SELECT DISTINCT sc.name, sc.role, sc.phone, sm2.store_name FROM public.store_contacts sc
        JOIN touched_stores ts ON ts.store_id=sc.store_id
        JOIN public.store_master sm2 ON sm2.id=sc.store_id
        WHERE sc.deleted_at IS NULL AND nullif(btrim(coalesce(sc.name,'')),'') IS NOT NULL) ppl;

  SELECT jsonb_build_object(
    'stores_visited',(SELECT count(DISTINCT store_id) FROM evj WHERE type='visit'),
    'new_stores',(SELECT count(*) FROM evj WHERE type IN ('new_store','prospect_promoted')),
    'orders_count',(SELECT count(*) FROM evj WHERE type='order'),
    'orders_total',(SELECT coalesce(sum(i.total_amount),0) FROM public.invoices i WHERE i.recorded_by_user_id=v_amb.user_id AND (i.created_at AT TIME ZONE 'America/New_York')::date=p_day AND i.deleted_at IS NULL),
    'payments_total',(SELECT coalesce(sum(i.amount_paid),0) FROM public.invoices i WHERE i.paid_by_user_id=v_amb.user_id AND (coalesce(i.paid_at,i.created_at) AT TIME ZONE 'America/New_York')::date=p_day AND i.deleted_at IS NULL),
    'notes_count',(SELECT count(*) FROM evj WHERE type='note')
  ) INTO v_summary;

  RETURN jsonb_build_object('day',p_day,'ambassador_id',v_amb.id,'ambassador_name',v_amb.name,'summary',v_summary,'events',v_events,'people',v_people);
END
$function$;
GRANT EXECUTE ON FUNCTION public.ambassador_activity_day(uuid,date) TO authenticated;