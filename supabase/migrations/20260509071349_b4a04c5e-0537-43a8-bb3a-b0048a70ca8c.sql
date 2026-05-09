
-- ===== C2.1: State normalization =====
UPDATE public.stores 
SET address_state = 'NY' 
WHERE address_state IN ('New York', 'ny', 'new york', 'NY ', ' NY');

-- ===== C2.2: Queens-as-state correction =====
-- Valid Queens zips: fix state + boro
UPDATE public.stores
SET address_state = 'NY',
    boro = 'Queens'
WHERE address_state = 'Queens'
  AND address_zip IS NOT NULL
  AND address_zip LIKE '11%';

-- Invalid: flag for review
INSERT INTO public.data_quality_flags (flag_type, entity_type, entity_id, details)
SELECT 'state_field_invalid', 'store', id, 
       jsonb_build_object('address_state', address_state, 'address_zip', address_zip)
FROM public.stores
WHERE address_state = 'Queens'
  AND (address_zip IS NULL OR address_zip NOT LIKE '11%')
  AND NOT EXISTS (
    SELECT 1 FROM public.data_quality_flags dqf
    WHERE dqf.entity_id = stores.id
      AND dqf.flag_type = 'state_field_invalid'
      AND dqf.resolved_at IS NULL
  );

-- ===== C2.3: Boro backfill from zip prefix =====
UPDATE public.stores SET boro = CASE
  WHEN address_zip BETWEEN '11201' AND '11256' THEN 'Brooklyn'
  WHEN address_zip IN ('11004','11005') THEN 'Queens'
  WHEN address_zip BETWEEN '11101' AND '11109' THEN 'Queens'
  WHEN address_zip BETWEEN '11351' AND '11697' THEN 'Queens'
  WHEN address_zip BETWEEN '10451' AND '10475' THEN 'Bronx'
  WHEN address_zip BETWEEN '10001' AND '10282' THEN 'Manhattan'
  WHEN address_zip BETWEEN '10301' AND '10314' THEN 'Staten Island'
  WHEN address_zip BETWEEN '07000' AND '08999' THEN 'New Jersey'
  ELSE boro
END
WHERE deleted_at IS NULL
  AND address_zip IS NOT NULL
  AND address_zip <> ''
  AND boro IS NULL;

-- ===== C3: unit_type normalization =====
UPDATE public.products 
SET unit_type = LOWER(TRIM(unit_type))
WHERE unit_type IS NOT NULL
  AND unit_type <> LOWER(TRIM(unit_type));

UPDATE public.products 
SET unit_type = 'box' 
WHERE unit_type IN ('box100', 'boxes');

-- ===== C5.1: Data gap audit view =====
CREATE OR REPLACE VIEW public.v_reactivation_data_gaps AS
SELECT 
  v.store_id,
  v.store_name,
  v.address_line_1,
  v.boro,
  v.address_zip,
  v.lifetime_tubes_delivered,
  v.reactivation_score,
  CASE WHEN v.address_zip IS NULL OR v.address_zip = '' THEN true ELSE false END as missing_zip,
  CASE WHEN v.boro IS NULL OR v.boro = '' THEN true ELSE false END as missing_boro,
  EXISTS(SELECT 1 FROM public.stores s 
         WHERE s.id = v.store_id 
         AND (s.phone IS NULL OR s.phone = '') 
         AND (s.email IS NULL OR s.email = '')) as missing_contact,
  (CASE WHEN v.address_zip IS NULL OR v.address_zip = '' THEN 1 ELSE 0 END +
   CASE WHEN v.boro IS NULL OR v.boro = '' THEN 1 ELSE 0 END +
   CASE WHEN EXISTS(SELECT 1 FROM public.stores s 
                    WHERE s.id = v.store_id 
                    AND (s.phone IS NULL OR s.phone = '') 
                    AND (s.email IS NULL OR s.email = '')) 
     THEN 2 ELSE 0 END) as gap_severity
FROM public.v_reactivation_targets v
WHERE 
  v.address_zip IS NULL 
  OR v.address_zip = ''
  OR v.boro IS NULL
  OR v.boro = ''
  OR EXISTS(SELECT 1 FROM public.stores s 
            WHERE s.id = v.store_id 
            AND (s.phone IS NULL OR s.phone = '') 
            AND (s.email IS NULL OR s.email = ''));

GRANT SELECT ON public.v_reactivation_data_gaps TO authenticated, anon;

-- ===== C5.2: Insert gap flags =====
INSERT INTO public.data_quality_flags (flag_type, entity_type, entity_id, details)
SELECT 
  'reactivation_target_data_gap',
  'store',
  g.store_id,
  jsonb_build_object(
    'missing_zip', g.missing_zip,
    'missing_boro', g.missing_boro,
    'missing_contact', g.missing_contact,
    'lifetime_tubes', g.lifetime_tubes_delivered,
    'gap_severity', g.gap_severity
  )
FROM public.v_reactivation_data_gaps g
WHERE NOT EXISTS (
  SELECT 1 FROM public.data_quality_flags dqf 
  WHERE dqf.entity_id = g.store_id 
    AND dqf.flag_type = 'reactivation_target_data_gap'
    AND dqf.resolved_at IS NULL
);
