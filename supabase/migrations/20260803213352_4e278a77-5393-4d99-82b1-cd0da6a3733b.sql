CREATE OR REPLACE VIEW public.v_flower_demand_list AS
SELECT sm.id AS store_id,
    sm.store_name,
    sm.nickname,
    sm.address,
    sm.city,
    sm.state,
    sm.zip,
    sm.borough_id,
    -- Read the real column first; the shared derivation is only a safety net
    -- for rows that could not be resolved during the backfill.
    COALESCE(b.name, public.derive_borough_name(sm.city, sm.zip, sm.address)) AS borough,
    sm.phone AS store_phone,
    sm.status AS store_status,
    sm.business_id,
    sm.last_visit_at,
    sm.sells_flowers_note AS flower_note,
    sm.sells_flowers_flagged_at AS flagged_at,
    sm.sells_flowers_flagged_by AS flagged_by_id,
    COALESCE(p.name, p.email) AS flagged_by_name,
    c.name AS contact_name,
    c.role AS contact_role,
    COALESCE(c.phone, sm.phone) AS contact_phone
   FROM store_master sm
     LEFT JOIN boroughs b ON b.id = sm.borough_id
     LEFT JOIN profiles p ON p.id = sm.sells_flowers_flagged_by
     LEFT JOIN LATERAL ( SELECT sc.name, sc.role, sc.phone
           FROM store_contacts sc
          WHERE sc.store_id = sm.id
          ORDER BY sc.is_primary DESC NULLS LAST, sc.created_at
         LIMIT 1) c ON true
  WHERE sm.sells_flowers IS TRUE;

GRANT SELECT ON public.v_flower_demand_list TO authenticated;
