
-- Map a store_tube_inventory_status.brand_id key to a products.id
CREATE OR REPLACE FUNCTION public.sample_brand_key_to_product_id(_key text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(regexp_replace(coalesce(_key,''), '[\s-]', '', 'g'))
    WHEN 'gasmask'            THEN '170adb8f-ac4e-40f4-a283-38730d30c5de'
    WHEN 'gasmaskbags'        THEN '170adb8f-ac4e-40f4-a283-38730d30c5de'
    WHEN 'gasmasktubes'       THEN 'dd5e14c0-d6c5-403a-a2d7-504181b0f4ea'
    WHEN 'gasmaskredtops'     THEN 'e3eea682-831e-4913-8b0e-563bc1325a1f'
    WHEN 'hotscolatti'        THEN '04336f6d-d69b-4ec8-8571-7088783b31d6'
    WHEN 'hotscalati'         THEN '04336f6d-d69b-4ec8-8571-7088783b31d6'
    WHEN 'hotscalatimixpack'  THEN '04336f6d-d69b-4ec8-8571-7088783b31d6'
    WHEN 'hotscolattimix'     THEN '04336f6d-d69b-4ec8-8571-7088783b31d6'
    WHEN 'hotscolattidark'    THEN '1c4f112e-97a1-4430-aae0-f1fcc0229a85'
    WHEN 'hotscalatidark'     THEN '1c4f112e-97a1-4430-aae0-f1fcc0229a85'
    WHEN 'hotscolattilight'   THEN '27e21aec-21a2-4ce7-9515-dbfd618a27c6'
    WHEN 'hotscalatilight'    THEN '27e21aec-21a2-4ce7-9515-dbfd618a27c6'
    WHEN 'hotscolattibros'    THEN 'fcfe5469-e9d3-40f3-8bf4-a4349086e1c3'
    WHEN 'hotscalatibros'     THEN 'fcfe5469-e9d3-40f3-8bf4-a4349086e1c3'
    WHEN 'hotmama'            THEN '2dfcbd00-0e44-4cd1-b80d-b00a33b123c5'
    WHEN 'grabba'             THEN '2d28e463-5296-4d42-b548-896d18ee906e'
    WHEN 'grabbarus'          THEN '2d28e463-5296-4d42-b548-896d18ee906e'
    WHEN 'grabbarus'          THEN '2d28e463-5296-4d42-b548-896d18ee906e'
    ELSE NULL END::uuid
$$;

CREATE OR REPLACE FUNCTION public.is_promo_sample_brand_key(_key text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = public.sample_brand_key_to_product_id(_key)
      AND p.is_promo_sample IS TRUE
  )
$$;

-- Preserve intent: if any GasMask-family SKU was flagged for a store, make sure
-- the GasMask promo tube row carries the flag before the extras are cleared.
UPDATE public.store_tube_inventory_status t
SET bring_samples = true, last_updated_at = now()
WHERE lower(regexp_replace(t.brand_id,'[\s-]','','g')) = 'gasmasktubes'
  AND t.bring_samples IS DISTINCT FROM true
  AND EXISTS (
    SELECT 1 FROM public.store_tube_inventory_status o
    WHERE o.store_id = t.store_id
      AND coalesce(o.is_simulation,false) = coalesce(t.is_simulation,false)
      AND o.bring_samples IS TRUE
      AND lower(regexp_replace(o.brand_id,'[\s-]','','g')) IN ('gasmask','gasmaskbags','gasmaskredtops')
  );

-- Clear every bring_samples flag that is not the brand's promo sample.
UPDATE public.store_tube_inventory_status t
SET bring_samples = false, last_updated_at = now()
WHERE t.bring_samples IS TRUE
  AND NOT public.is_promo_sample_brand_key(t.brand_id);

-- Fail-closed enforcement going forward.
CREATE OR REPLACE FUNCTION public.enforce_promo_sample_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.bring_samples IS TRUE AND NOT public.is_promo_sample_brand_key(NEW.brand_id) THEN
    NEW.bring_samples := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_promo_sample_only ON public.store_tube_inventory_status;
CREATE TRIGGER trg_enforce_promo_sample_only
BEFORE INSERT OR UPDATE OF bring_samples ON public.store_tube_inventory_status
FOR EACH ROW EXECUTE FUNCTION public.enforce_promo_sample_only();

-- Link the existing Sep 5 test SMS to its store + contact (no new record).
UPDATE public.communication_logs
SET store_id = '8c20bfb4-b087-489d-9a8f-9ee7bc64b4d8',
    contact_id = 'bc0b24ef-1372-4f49-af2c-2a870eeae2d9'
WHERE id = '95d243ea-9d74-48e2-8d1c-041bf447a4be'
  AND store_id IS NULL;
