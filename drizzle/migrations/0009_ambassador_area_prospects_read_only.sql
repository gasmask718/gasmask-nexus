CREATE OR REPLACE FUNCTION public.ambassador_area_prospect_keys()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT DISTINCT p.prospect_key FROM public.ambassadors a
 JOIN public.ambassador_territory_coverage tc ON tc.ambassador_id=a.id
 JOIN public.store_prospects p ON CASE tc.region_type::text
 WHEN 'state' THEN nullif(public.normalize_us_state(tc.region_value),'') = nullif(public.normalize_us_state(p.state),'')
 WHEN 'city' THEN lower(tc.region_value)=lower(p.borough_or_county) OR lower(tc.region_value)=lower(p.neighborhood)
 WHEN 'custom_zone' THEN lower(tc.region_value)=lower(p.borough_or_county) OR lower(tc.region_value)=lower(p.neighborhood)
 WHEN 'zip' THEN substring(regexp_replace(tc.region_value,'[^0-9]','','g') from 1 for 5)=substring(regexp_replace(p.zip,'[^0-9]','','g') from 1 for 5) AND length(regexp_replace(tc.region_value,'[^0-9]','','g'))>=5 AND length(regexp_replace(p.zip,'[^0-9]','','g'))>=5
 WHEN 'county' THEN lower(tc.region_value)=lower(p.borough_or_county)
 ELSE false END
 WHERE a.user_id=auth.uid() AND a.is_active IS TRUE AND a.deleted_at IS NULL
 AND public.has_role(auth.uid(),'ambassador'::public.app_role) AND nullif(tc.region_value,'') IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.ambassador_area_prospect_keys() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ambassador_area_prospect_keys() TO authenticated, service_role;
GRANT SELECT ON public.store_prospects TO authenticated;
CREATE POLICY store_prospects_select_ambassador_territory ON public.store_prospects FOR SELECT TO authenticated USING (prospect_key IN (SELECT public.ambassador_area_prospect_keys()));
CREATE OR REPLACE FUNCTION public.ambassador_area_prospects_page(p_search text DEFAULT '', p_neighborhood text DEFAULT '', p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH visible AS MATERIALIZED (
 SELECT prospect_key,store_name,address,zip,state,region,borough_or_county,neighborhood,phone,store_type,tier,priority_score,prospect_status,recheck_note,promoted_store_id FROM public.store_prospects
 WHERE prospect_status IS DISTINCT FROM 'Skip' AND promoted_store_id IS NULL
 AND prospect_key IN (SELECT public.ambassador_area_prospect_keys())
 ), filtered AS MATERIALIZED (
 SELECT * FROM visible WHERE (coalesce(p_neighborhood,'')='' OR neighborhood=p_neighborhood)
 AND (coalesce(p_search,'')='' OR strpos(lower(concat_ws(' ',store_name,address,zip,neighborhood,phone,borough_or_county)),lower(p_search))>0)
 ), paged AS (
 SELECT * FROM filtered ORDER BY coalesce(recheck_note LIKE 'Go%',false) DESC,priority_score DESC NULLS LAST,prospect_key
 LIMIT 25 OFFSET (greatest(coalesce(p_page,1),1)-1)*25
 ) SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'area_total',(SELECT count(*) FROM visible),
 'neighborhoods',coalesce((SELECT jsonb_agg(neighborhood ORDER BY neighborhood) FROM (SELECT DISTINCT neighborhood FROM visible WHERE nullif(neighborhood,'') IS NOT NULL) n),'[]'::jsonb),
 'items',coalesce((SELECT jsonb_agg(to_jsonb(paged)) FROM paged),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.ambassador_area_prospects_page(text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ambassador_area_prospects_page(text,text,integer) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.promote_store_prospect(p_key text, p_outcome text DEFAULT 'Visited'::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_id uuid; p public.store_prospects;
begin
  IF NOT (public.is_staff(auth.uid()) OR public.is_elevated_user()) THEN RAISE EXCEPTION 'Staff access required to promote store prospects' USING ERRCODE='42501'; END IF;
  select * into p from public.store_prospects where prospect_key = p_key and promoted_store_id is null;
  if not found then raise exception 'Prospect % not found or already promoted', p_key; end if;
  insert into public.store_master (store_name, address, city, state, zip, phone, borough, neighborhood, corridor,
                                   store_type, relationship_status, status, notes)
  values (p.store_name, p.address, p.city, p.state, p.zip, p.phone, p.borough_or_county, p.neighborhood, p.corridor,
          p.store_type, 'New – first contact', 'prospect',
          format('Promoted from %s (%s). Score %s, %s. Sources: %s', p.import_batch, p.prospect_key, p.priority_score, p.tier, p.found_in_sources))
  returning id into v_id;
  update public.store_prospects set promoted_store_id = v_id, promoted_at = now(), prospect_status = 'Promoted' where prospect_key = p_key;
  return v_id;
end $function$;