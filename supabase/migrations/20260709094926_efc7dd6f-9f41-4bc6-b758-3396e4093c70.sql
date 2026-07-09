
CREATE OR REPLACE FUNCTION public.clipper_submission_on_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
  v_base numeric;
  v_exists uuid;
BEGIN
  IF NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM 'approved') THEN

    SELECT COALESCE(base_rate_per_1k, 0) INTO v_rate
    FROM public.clipper_campaigns
    WHERE id = NEW.campaign_id;

    v_base := ROUND((COALESCE(NEW.views, 0)::numeric / 1000) * COALESCE(v_rate, 0), 2);

    NEW.base_earnings  := v_base;
    NEW.total_earnings := v_base + COALESCE(NEW.conversion_earnings, 0);
    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
    END IF;

    SELECT id INTO v_exists
    FROM public.clipper_earnings
    WHERE submission_id = NEW.id
      AND earning_type = 'base_views'
    LIMIT 1;

    IF v_exists IS NULL THEN
      INSERT INTO public.clipper_earnings
        (clipper_id, submission_id, campaign_id, earning_type, amount, views_at_calculation, status)
      VALUES
        (NEW.clipper_id, NEW.id, NEW.campaign_id, 'base_views', v_base, COALESCE(NEW.views, 0), 'pending');
    ELSE
      UPDATE public.clipper_earnings
      SET amount = v_base,
          views_at_calculation = COALESCE(NEW.views, 0)
      WHERE id = v_exists;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clipper_submission_on_approve ON public.clipper_submissions;

CREATE TRIGGER trg_clipper_submission_on_approve
BEFORE UPDATE ON public.clipper_submissions
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
EXECUTE FUNCTION public.clipper_submission_on_approve();
