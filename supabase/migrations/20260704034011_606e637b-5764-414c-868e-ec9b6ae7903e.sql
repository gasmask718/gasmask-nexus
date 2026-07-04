
CREATE OR REPLACE FUNCTION public.enroll_beneficiary_on_applied()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_id uuid;
  v_full_name text;
  v_existing uuid;
BEGIN
  -- Only act when application_status transitions to (or is inserted as) 'applied'
  IF NEW.application_status IS DISTINCT FROM 'applied' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.application_status = 'applied' THEN
    RETURN NEW;
  END IF;

  v_full_name := trim(concat_ws(' ', NEW.first_name, NEW.last_name));

  -- Try to match a program by business_unit_interest
  IF NEW.business_unit_interest IS NOT NULL THEN
    SELECT id INTO v_program_id
    FROM public.uben_programs
    WHERE name ILIKE NEW.business_unit_interest
    LIMIT 1;
  END IF;

  -- Skip if beneficiary with same email already enrolled in same program
  IF NEW.email IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.uben_beneficiaries
    WHERE email = NEW.email
      AND program_id IS NOT DISTINCT FROM v_program_id
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.uben_beneficiaries
    (name, email, phone, program_id, enrollment_date, status, dynasty_business_referred)
  VALUES
    (v_full_name, NEW.email, NEW.phone, v_program_id, CURRENT_DATE, 'active', NEW.business_unit_interest);

  IF v_program_id IS NOT NULL THEN
    UPDATE public.uben_programs
       SET participant_count = COALESCE(participant_count, 0) + 1,
           updated_at = now()
     WHERE id = v_program_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uben_app_enroll ON public.uben_ambassador_applications;

CREATE TRIGGER trg_uben_app_enroll
AFTER INSERT OR UPDATE OF application_status
ON public.uben_ambassador_applications
FOR EACH ROW
EXECUTE FUNCTION public.enroll_beneficiary_on_applied();
