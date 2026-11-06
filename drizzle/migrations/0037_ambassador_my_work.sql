CREATE OR REPLACE FUNCTION public._ambassador_work_access(p_ambassador_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_amb public.ambassadors%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v_amb FROM public.ambassadors WHERE id=p_ambassador_id AND deleted_at IS NULL;
  IF v_amb.id IS NULL THEN RAISE EXCEPTION 'Ambassador not found'; END IF;
  IF NOT (v_amb.user_id = v_uid OR public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'owner'::public.app_role)) THEN
    RAISE EXCEPTION 'You can only view your own work';
  END IF;
  RETURN v_amb.user_id;
END $$;
REVOKE ALL ON FUNCTION public._ambassador_work_access(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._ambassador_work_events(p_amb uuid, p_uid uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE(item_id text, type text, at timestamptz, store_id uuid, title text, detail text, status text, amount numeric, extra jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT 'v'||sv.id, 'visit', sv.started_at, sv.store_id, 'Visit', coalesce(sv.visit_type,'visit'), sv.status, NULL::numeric, NULL::jsonb
    FROM public.store_visits sv WHERE p_uid IS NOT NULL AND sv.visited_by=p_uid AND sv.started_at>=p_from AND sv.started_at<p_to
  UNION ALL SELECT 'n'||sn.id, 'note', sn.created_at, sn.store_id, 'Note', left(sn.note_text,500), sn.source, NULL, NULL
    FROM public.store_notes sn WHERE (sn.ambassador_id=p_amb OR (p_uid IS NOT NULL AND sn.created_by=p_uid)) AND sn.deleted_at IS NULL AND sn.created_at>=p_from AND sn.created_at<p_to
  UNION ALL SELECT 'c'||st.store_id||st.brand_id, 'count', st.last_updated_at, st.store_id, 'Count',
      CASE WHEN st.brand_id='gasmask' THEN 'GasMask bags' WHEN st.brand_id='gasmasktubes' THEN 'GasMask tubes' ELSE coalesce(st.brand_name, st.brand_id) END||': '||coalesce(st.current_tubes_left,0)||' left', NULL, NULL, NULL
    FROM public.store_tube_inventory_status st WHERE p_uid IS NOT NULL AND st.last_updated_by=p_uid AND st.is_simulation IS FALSE AND st.last_updated_at>=p_from AND st.last_updated_at<p_to
  UNION ALL SELECT 'o'||dr.id, 'order', dr.created_at, dr.store_id, 'Order request',
      coalesce((SELECT string_agg((x->>'quantity')||' box '||(x->>'name'), ', ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(dr.items)='array' THEN dr.items ELSE '[]'::jsonb END) x),'') || coalesce(' — '||dr.notes,''),
      CASE WHEN dr.status IN ('new','confirmed') THEN 'requested' WHEN dr.status='scheduled' THEN 'on route' ELSE dr.status END, NULL, dr.items
    FROM public.delivery_requests dr WHERE p_uid IS NOT NULL AND dr.requested_by=p_uid AND dr.source IN ('field_order_request','voice_order_request') AND dr.created_at>=p_from AND dr.created_at<p_to
  UNION ALL SELECT 'p'||i.id, 'money', coalesce(i.paid_at,i.created_at), i.store_id, 'Payment recorded',
      'Invoice '||coalesce(i.invoice_number,'')||' · '||coalesce(i.payment_method,'method not set'), i.payment_status::text, i.amount_paid, NULL
    FROM public.invoices i WHERE p_uid IS NOT NULL AND i.paid_by_user_id=p_uid AND i.deleted_at IS NULL AND coalesce(i.amount_paid,0)>0 AND coalesce(i.paid_at,i.created_at)>=p_from AND coalesce(i.paid_at,i.created_at)<p_to
  UNION ALL SELECT 'k'||sc.id, 'contact', coalesce(sc.verified_at, sc.created_at), sc.store_id, 'Contact',
      coalesce(sc.name,'(no name)')||coalesce(' · '||sc.role,'')||coalesce(' · '||sc.phone,''), CASE WHEN sc.verified_by=p_uid THEN 'verified' ELSE 'added/changed' END, NULL, NULL
    FROM public.store_contacts sc WHERE p_uid IS NOT NULL AND (sc.verified_by=p_uid OR sc.updated_by=p_uid) AND sc.deleted_at IS NULL AND coalesce(sc.verified_at, sc.created_at)>=p_from AND coalesce(sc.verified_at, sc.created_at)<p_to
  UNION ALL SELECT 'l'||sm.id, 'new_store', sm.confirmed_at, sm.id, 'Store locked to you', 'Confirmed by your first visit', NULL, NULL, NULL
    FROM public.store_master sm WHERE sm.confirmed_by_ambassador_id=p_amb AND sm.deleted_at IS NULL AND sm.confirmed_at>=p_from AND sm.confirmed_at<p_to
  UNION ALL SELECT 's'||sm.id, 'new_store', sm.sourced_at, sm.id, 'New store found', 'Added by you', NULL, NULL, NULL
    FROM public.store_master sm WHERE sm.sourced_by_ambassador_id=p_amb AND sm.deleted_at IS NULL AND sm.sourced_at>=p_from AND sm.sourced_at<p_to
  UNION ALL SELECT 'f'||fs.id, 'status', fs.created_at, fs.store_id, 'Change sent', fs.entity_type::text||' / '||fs.action_type::text, fs.submission_status::text, NULL, NULL
    FROM public.field_submissions fs WHERE p_uid IS NOT NULL AND fs.submitted_by_user_id=p_uid AND fs.created_at>=p_from AND fs.created_at<p_to
  UNION ALL SELECT 'a'||vn.id, 'voice', vn.confirmed_at, vn.store_id, 'Voice update', coalesce(vn.transcript,''), 'saved', NULL, jsonb_build_object('path', vn.file_url, 'summary', vn.summary)
    FROM public.store_voice_notes vn WHERE p_uid IS NOT NULL AND vn.created_by=p_uid AND vn.status='confirmed' AND vn.confirmed_at>=p_from AND vn.confirmed_at<p_to
$$;
REVOKE ALL ON FUNCTION public._ambassador_work_events(uuid,uuid,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ambassador_work_me()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_is_owner boolean; v_mine uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  v_is_owner := public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'owner'::public.app_role);
  SELECT id INTO v_mine FROM public.ambassadors WHERE user_id=v_uid AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  RETURN jsonb_build_object('is_owner', v_is_owner, 'my_ambassador_id', v_mine,
    'ambassadors', CASE WHEN v_is_owner THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name),'[]') FROM public.ambassadors WHERE deleted_at IS NULL AND coalesce(is_simulation,false)=false) ELSE '[]'::jsonb END);
END $$;
GRANT EXECUTE ON FUNCTION public.ambassador_work_me() TO authenticated;

CREATE OR REPLACE FUNCTION public.ambassador_work_feed(p_ambassador_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_type text DEFAULT NULL,
  p_search text DEFAULT NULL, p_neighborhood text DEFAULT NULL, p_store_id uuid DEFAULT NULL, p_before timestamptz DEFAULT NULL, p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid; v_from timestamptz; v_to timestamptz; v_rows jsonb;
BEGIN
  v_uid := public._ambassador_work_access(p_ambassador_id);
  v_from := coalesce((p_from::timestamp AT TIME ZONE 'America/New_York'), '2000-01-01'::timestamptz);
  v_to := least(coalesce(((p_to + 1)::timestamp AT TIME ZONE 'America/New_York'), now() + interval '1 day'), coalesce(p_before, 'infinity'::timestamptz));
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.at DESC),'[]') INTO v_rows FROM (
    SELECT e.*, (e.at AT TIME ZONE 'America/New_York')::date AS day, sm.store_name, concat_ws(', ', sm.address, sm.city, sm.state) AS store_address, coalesce(sm.neighborhood, sm.borough) AS neighborhood
    FROM public._ambassador_work_events(p_ambassador_id, v_uid, v_from, v_to) e
    LEFT JOIN public.store_master sm ON sm.id=e.store_id
    WHERE e.at IS NOT NULL
      AND (p_type IS NULL OR e.type=p_type OR (p_type='visit' AND e.type IN ('visit','count')))
      AND (p_store_id IS NULL OR e.store_id=p_store_id)
      AND (nullif(btrim(p_search),'') IS NULL OR sm.store_name ILIKE '%'||p_search||'%' OR sm.address ILIKE '%'||p_search||'%')
      AND (nullif(btrim(p_neighborhood),'') IS NULL OR coalesce(sm.neighborhood, sm.borough, sm.city) ILIKE '%'||p_neighborhood||'%')
    ORDER BY e.at DESC LIMIT least(greatest(coalesce(p_limit,50),1),200)
  ) r;
  RETURN jsonb_build_object('items', v_rows);
END $$;
GRANT EXECUTE ON FUNCTION public.ambassador_work_feed(uuid,date,date,text,text,text,uuid,timestamptz,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.ambassador_work_summary(p_ambassador_id uuid, p_from date, p_to date, p_store_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid; v_from timestamptz; v_to timestamptz; v_today date := (now() AT TIME ZONE 'America/New_York')::date;
  v_counts jsonb; v_today_counts jsonb; v_boxes jsonb; v_earn numeric; v_goback jsonb; v_follow jsonb;
BEGIN
  v_uid := public._ambassador_work_access(p_ambassador_id);
  v_from := p_from::timestamp AT TIME ZONE 'America/New_York';
  v_to := (p_to + 1)::timestamp AT TIME ZONE 'America/New_York';
  SELECT jsonb_build_object(
    'stores_visited', count(DISTINCT store_id) FILTER (WHERE type IN ('visit','count','voice')),
    'new_stores', count(DISTINCT store_id) FILTER (WHERE type='new_store'),
    'counts', count(*) FILTER (WHERE type='count'),
    'orders', count(*) FILTER (WHERE type='order'),
    'money', coalesce(sum(amount) FILTER (WHERE type='money'),0),
    'contacts', count(*) FILTER (WHERE type='contact'),
    'notes', count(*) FILTER (WHERE type='note'),
    'voice', count(*) FILTER (WHERE type='voice'))
  INTO v_counts FROM public._ambassador_work_events(p_ambassador_id, v_uid, v_from, v_to) e WHERE p_store_id IS NULL OR e.store_id=p_store_id;
  SELECT jsonb_build_object(
    'stores_visited', count(DISTINCT store_id) FILTER (WHERE type IN ('visit','count','voice')),
    'new_stores', count(DISTINCT store_id) FILTER (WHERE type='new_store'),
    'counts', count(*) FILTER (WHERE type='count'),
    'orders', count(*) FILTER (WHERE type='order'),
    'money', coalesce(sum(amount) FILTER (WHERE type='money'),0),
    'contacts', count(*) FILTER (WHERE type='contact'),
    'notes', count(*) FILTER (WHERE type='note'))
  INTO v_today_counts FROM public._ambassador_work_events(p_ambassador_id, v_uid, v_today::timestamp AT TIME ZONE 'America/New_York', (v_today+1)::timestamp AT TIME ZONE 'America/New_York') e;
  -- Boxes moved: non-cancelled order requests; earnings: delivered only, 50% of (store price - ambassador/wholesale price) per unit
  SELECT coalesce(jsonb_object_agg(name, boxes),'{}'), coalesce(sum(earn),0) INTO v_boxes, v_earn FROM (
    SELECT x->>'name' AS name, sum((x->>'quantity')::numeric) AS boxes,
      sum(CASE WHEN dr.status='delivered' THEN (x->>'quantity')::numeric * coalesce(p.units_per_box,100) * greatest(coalesce(p.store_price,0)-coalesce(p.wholesale_price,0),0) * 0.5 ELSE 0 END) AS earn
    FROM public.delivery_requests dr CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(dr.items)='array' THEN dr.items ELSE '[]'::jsonb END) x
    LEFT JOIN public.products p ON p.id::text = x->>'product_id'
    WHERE v_uid IS NOT NULL AND dr.requested_by=v_uid AND dr.source IN ('field_order_request','voice_order_request') AND dr.status<>'cancelled'
      AND dr.created_at>=v_from AND dr.created_at<v_to AND (p_store_id IS NULL OR dr.store_id=p_store_id)
    GROUP BY 1) b;
  SELECT coalesce(jsonb_agg(g ORDER BY g.last_visit_at NULLS FIRST),'[]') INTO v_goback FROM (
    SELECT sm.id AS store_id, sm.store_name, concat_ws(', ', sm.address, sm.city) AS store_address, sm.last_visit_at, sm.phone
    FROM public.store_master sm
    WHERE (sm.confirmed_by_ambassador_id=p_ambassador_id OR sm.assigned_ambassador_id=p_ambassador_id) AND sm.deleted_at IS NULL
      AND (sm.last_visit_at IS NULL OR sm.last_visit_at < now() - interval '14 days') AND (p_store_id IS NULL OR sm.id=p_store_id)
    ORDER BY sm.last_visit_at NULLS FIRST LIMIT 60) g;
  -- Follow-ups: recent notes that mention a come-back time, where no later visit has happened yet
  SELECT coalesce(jsonb_agg(f ORDER BY f.at DESC),'[]') INTO v_follow FROM (
    SELECT sn.id, sn.created_at AS at, sn.store_id, sm.store_name, concat_ws(', ', sm.address, sm.city) AS store_address, left(sn.note_text,300) AS note,
      coalesce((SELECT sc.phone FROM public.store_contacts sc WHERE sc.store_id=sn.store_id AND sc.deleted_at IS NULL AND sc.phone IS NOT NULL ORDER BY sc.is_primary DESC NULLS LAST, sc.created_at DESC LIMIT 1), sm.phone) AS phone
    FROM public.store_notes sn JOIN public.store_master sm ON sm.id=sn.store_id
    WHERE (sn.ambassador_id=p_ambassador_id OR (v_uid IS NOT NULL AND sn.created_by=v_uid)) AND sn.deleted_at IS NULL
      AND sn.created_at > now() - interval '30 days' AND (p_store_id IS NULL OR sn.store_id=p_store_id)
      AND sn.note_text ~* '(come back|comeback|return|call back|callback|best time|boss (is )?(here|in)|owner (is )?(here|in)|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\m\d{1,2}(:\d\d)? ?(am|pm)\M|lunes|martes|mañana|regres|volver)'
      AND (sm.last_visit_at IS NULL OR sm.last_visit_at <= sn.created_at + interval '1 hour')
    ORDER BY sn.created_at DESC LIMIT 40) f;
  RETURN jsonb_build_object('from',p_from,'to',p_to,'today',v_today,'today_counts',v_today_counts,'counts',v_counts,'boxes',v_boxes,'earnings_estimate',round(v_earn,2),'go_back',v_goback,'follow_ups',v_follow,
    'last_interaction', CASE WHEN p_store_id IS NOT NULL THEN (SELECT to_jsonb(x) FROM (SELECT e.type, e.title, e.detail, e.at FROM public._ambassador_work_events(p_ambassador_id, v_uid, '2000-01-01', now()+interval '1 day') e WHERE e.store_id=p_store_id ORDER BY e.at DESC LIMIT 1) x) END);
END $$;
GRANT EXECUTE ON FUNCTION public.ambassador_work_summary(uuid,date,date,uuid) TO authenticated;