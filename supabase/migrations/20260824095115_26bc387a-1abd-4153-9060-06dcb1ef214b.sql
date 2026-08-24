-- 1. Shipment rating provenance + carrier adjustment tracking
ALTER TABLE public.dd_shipments
  ADD COLUMN IF NOT EXISTS label_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS box_id uuid REFERENCES public.dd_box_sizes(id),
  ADD COLUMN IF NOT EXISTS box_name text,
  ADD COLUMN IF NOT EXISTS rated_weight_oz numeric,
  ADD COLUMN IF NOT EXISTS dim_weight_oz numeric,
  ADD COLUMN IF NOT EXISTS billable_weight_oz numeric,
  ADD COLUMN IF NOT EXISTS carrier_billed_weight_oz numeric,
  ADD COLUMN IF NOT EXISTS carrier_adjustment_amount numeric,
  ADD COLUMN IF NOT EXISTS carrier_adjustment_detail jsonb,
  ADD COLUMN IF NOT EXISTS adjustment_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS dimension_variance_flag boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS dd_shipments_adjustment_idx
  ON public.dd_shipments (wholesaler_id) WHERE dimension_variance_flag;

-- 2. Supplier accuracy metrics
ALTER TABLE public.dd_supplier_metrics
  ADD COLUMN IF NOT EXISTS shipments_labeled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dimension_adjustments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dimension_adjustment_amount numeric NOT NULL DEFAULT 0;

-- 3. A listing cannot go live without weight and dimensions.
--    EasyPost cannot rate a parcel without them, so checkout would be guessing.
CREATE OR REPLACE FUNCTION public.dd_require_shipping_dimensions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  l numeric; w numeric; h numeric;
BEGIN
  IF COALESCE(NEW.status, '') <> 'active' THEN
    RETURN NEW;
  END IF;

  l := COALESCE(NEW.length_in, NULLIF(NEW.dimensions->>'length_in','')::numeric, NULLIF(NEW.dimensions->>'length','')::numeric);
  w := COALESCE(NEW.width_in,  NULLIF(NEW.dimensions->>'width_in','')::numeric,  NULLIF(NEW.dimensions->>'width','')::numeric);
  h := COALESCE(NEW.height_in, NULLIF(NEW.dimensions->>'height_in','')::numeric, NULLIF(NEW.dimensions->>'height','')::numeric);

  IF COALESCE(NEW.weight_oz, 0) <= 0 THEN
    RAISE EXCEPTION 'Shipping weight is required before this product can go live. Enter the item weight in ounces.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(l,0) <= 0 OR COALESCE(w,0) <= 0 OR COALESCE(h,0) <= 0 THEN
    RAISE EXCEPTION 'Shipping dimensions are required before this product can go live. Enter length, width and height in inches.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dd_require_shipping_dimensions_trg ON public.products_all;
CREATE TRIGGER dd_require_shipping_dimensions_trg
  BEFORE INSERT OR UPDATE ON public.products_all
  FOR EACH ROW EXECUTE FUNCTION public.dd_require_shipping_dimensions();

-- 4. Record a carrier re-weigh / dimension adjustment against the supplier
CREATE OR REPLACE FUNCTION public.dd_record_carrier_adjustment(
  _shipment_id uuid,
  _billed_weight_oz numeric,
  _adjustment_amount numeric,
  _detail jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wid uuid;
  _pstart date := date_trunc('month', now())::date;
  _pend   date := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
BEGIN
  UPDATE public.dd_shipments
     SET carrier_billed_weight_oz = _billed_weight_oz,
         carrier_adjustment_amount = _adjustment_amount,
         carrier_adjustment_detail = _detail,
         adjustment_detected_at = now(),
         dimension_variance_flag = true
   WHERE id = _shipment_id
   RETURNING wholesaler_id INTO _wid;

  IF _wid IS NULL THEN RETURN; END IF;

  INSERT INTO public.dd_supplier_metrics (wholesaler_id, period_start, period_end, dimension_adjustments, dimension_adjustment_amount)
  VALUES (_wid, _pstart, _pend, 1, COALESCE(_adjustment_amount, 0))
  ON CONFLICT (wholesaler_id, period_start) DO UPDATE
    SET dimension_adjustments = public.dd_supplier_metrics.dimension_adjustments + 1,
        dimension_adjustment_amount = public.dd_supplier_metrics.dimension_adjustment_amount + COALESCE(EXCLUDED.dimension_adjustment_amount, 0),
        calculated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.dd_record_carrier_adjustment(uuid, numeric, numeric, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dd_record_carrier_adjustment(uuid, numeric, numeric, jsonb) TO service_role;