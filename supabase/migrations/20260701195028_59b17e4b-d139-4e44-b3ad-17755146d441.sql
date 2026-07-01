CREATE OR REPLACE VIEW public.dc_unified_leads
WITH (security_invoker = true) AS
SELECT
  cp.id AS lead_id, 'top_tier'::text AS business_unit_key, 'crm_partners'::text AS source_table,
  cp.company_name AS lead_name, cp.contact_name, cp.phone, cp.email, cp.city, cp.state,
  cp.tt_last_disposition::text AS last_disposition, cp.tt_last_call_at AS last_contacted_at,
  COALESCE(cp.tt_call_attempts,0)::int AS call_attempts,
  cp.tt_acquisition_stage::text AS lifecycle_stage, cp.tt_acquisition_notes AS notes,
  COALESCE(cp.compliance_hold,false) AS compliance_hold,
  COALESCE(cp.phone_invalid,false) AS phone_invalid,
  cp.created_at, cp.updated_at
FROM public.crm_partners cp
WHERE cp.business_slug='toptier-experience' AND COALESCE(cp.is_simulation,false)=false
UNION ALL
SELECT ul.id,'unforgettable_times','ut_partner_leads',ul.business_name,ul.contact_name,ul.phone,ul.email,ul.city,ul.state,
  ul.last_outcome::text,ul.last_contacted_at,COALESCE(ul.outreach_count,0)::int,
  ul.automation_state::text,ul.notes,
  COALESCE(ul.ai_call_eligible=false AND ul.status='dnc',false),false,ul.created_at,ul.updated_at
FROM public.ut_partner_leads ul
UNION ALL
SELECT sf.id,'surplus_funds','surplus_funds_leads',
  TRIM(CONCAT_WS(' ',sf.first_name,sf.last_name)),
  TRIM(CONCAT_WS(' ',sf.first_name,sf.last_name)),
  sf.phone,sf.email,sf.city,sf.state,sf.status::text,sf.last_called_at,
  COALESCE(sf.call_count,0)::int,sf.status::text,sf.notes,false,false,sf.created_at,sf.updated_at
FROM public.surplus_funds_leads sf
UNION ALL
SELECT re.id,'real_estate','re_leads',
  TRIM(CONCAT_WS(' ',re.first_name,re.last_name)),
  TRIM(CONCAT_WS(' ',re.first_name,re.last_name)),
  re.phone,re.email,re.city,re.state,re.status::text,re.last_called_at,
  COALESCE(re.call_count,0)::int,NULL::text,re.notes,false,false,re.created_at,re.updated_at
FROM public.re_leads re
UNION ALL
SELECT w.id,'dynasty_direct','wholesalers',w.name,w.contact_name,w.phone,w.email,w.city,w.state,
  w.last_call_disposition::text,w.last_contacted_at,COALESCE(w.call_attempts,0)::int,
  w.status::text,w.inventory_notes,
  COALESCE(w.compliance_hold,false),COALESCE(w.phone_invalid,false),w.created_at,w.updated_at
FROM public.wholesalers w
WHERE w.deleted_at IS NULL AND COALESCE(w.is_simulation,false)=false
UNION ALL
SELECT sp.id,'gasmask','sales_prospects',sp.store_name,sp.contact_name,sp.phone,sp.email,sp.city,sp.state,
  sp.gasmask_call_status::text,sp.last_contacted::timestamptz,0::int,
  sp.pipeline_stage::text,sp.notes,false,false,sp.created_at,sp.updated_at
FROM public.sales_prospects sp
WHERE sp.lead_type='store' AND COALESCE(sp.archived,false)=false
UNION ALL
SELECT bl.id,'brandaro','brandaro_qualified_leads',bl.business_name,bl.full_name,bl.phone_number,bl.email,bl.city,NULL::text,
  bl.lead_status::text,bl.last_dc_call_date,COALESCE(bl.call_attempts,0)::int,
  bl.pipeline_stage::text,bl.call_notes,false,false,bl.created_at,bl.updated_at
FROM public.brandaro_qualified_leads bl;

REVOKE ALL ON public.dc_unified_leads FROM PUBLIC;
GRANT SELECT ON public.dc_unified_leads TO authenticated;
GRANT SELECT ON public.dc_unified_leads TO service_role;