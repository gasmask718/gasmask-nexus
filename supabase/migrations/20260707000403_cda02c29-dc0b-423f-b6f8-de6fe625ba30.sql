CREATE OR REPLACE FUNCTION public.auto_advance_client_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.credit_score_estimate >= 680
    AND (OLD.credit_score_estimate IS NULL OR OLD.credit_score_estimate < 680)
    AND NEW.stage = 'credit_repair'
  THEN
    NEW.stage := 'credit_ready';
  END IF;

  IF NEW.funding_received > 0
    AND (OLD.funding_received IS NULL OR OLD.funding_received = 0)
    AND NEW.stage = 'credit_ready'
  THEN
    NEW.stage := 'funding_active';
  END IF;

  IF NEW.funding_target IS NOT NULL
    AND NEW.funding_target > 0
    AND NEW.funding_received >= NEW.funding_target * 0.9
    AND NEW.stage IN ('credit_ready','funding_active')
  THEN
    NEW.stage := 'funded';
  END IF;

  IF NEW.grant_eligible = true
    AND (OLD.grant_eligible IS NULL OR OLD.grant_eligible = false)
    AND NEW.stage IN ('funded','funding_active','credit_ready')
  THEN
    NEW.stage := 'grant_eligible';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_stage_auto_advance ON public.funding_clients;

CREATE TRIGGER client_stage_auto_advance
BEFORE UPDATE ON public.funding_clients
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_client_stage();