CREATE OR REPLACE FUNCTION public.generate_clipper_tracking_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_business text;
  v_code text;
BEGIN
  SELECT dynasty_business INTO v_business
  FROM public.clipper_campaigns
  WHERE id = NEW.campaign_id;

  v_code := encode(gen_random_bytes(4), 'hex');

  NEW.tracking_link :=
    'https://dynastyclipper.io/go/' || COALESCE(v_business, 'unknown') || '/' || v_code;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_assignment_insert ON public.clipper_assignments;

CREATE TRIGGER before_assignment_insert
  BEFORE INSERT ON public.clipper_assignments
  FOR EACH ROW
  WHEN (NEW.tracking_link IS NULL)
  EXECUTE FUNCTION public.generate_clipper_tracking_link();