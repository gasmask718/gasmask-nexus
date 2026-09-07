CREATE TABLE IF NOT EXISTS public.store_contact_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.store_contacts(id) ON DELETE CASCADE,
  store_id uuid,
  phone text,
  status text NOT NULL,
  previous_status text,
  verified_by uuid,
  verified_by_label text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_contact_verification_events TO authenticated;
GRANT ALL ON public.store_contact_verification_events TO service_role;

ALTER TABLE public.store_contact_verification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read verification history"
ON public.store_contact_verification_events
FOR SELECT TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_scve_contact_at
  ON public.store_contact_verification_events (contact_id, verified_at DESC);

-- Stamp actor + timestamp on every verification status change, whatever the path.
CREATE OR REPLACE FUNCTION public.stamp_contact_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_label text;
  v_method text;
BEGIN
  IF NEW.number_verification_status IS DISTINCT FROM OLD.number_verification_status
     AND NEW.number_verification_status IS NOT NULL THEN

    IF v_actor IS NOT NULL THEN
      NEW.verified_by := v_actor;
      SELECT COALESCE(NULLIF(p.name, ''), p.email) INTO v_label
        FROM public.profiles p WHERE p.id = v_actor;
      v_method := 'manual';
    ELSE
      -- No session: automation path (verification text, delivery report, inbound YES).
      NEW.verified_by := NULL;
      v_method := CASE
        WHEN NEW.number_verification_status = 'confirmed' THEN 'customer_reply'
        WHEN NEW.number_verification_status = 'sent' THEN 'verification_text'
        WHEN NEW.number_verification_status = 'delivered' THEN 'carrier_delivery'
        ELSE 'system'
      END;
      v_label := CASE v_method
        WHEN 'customer_reply' THEN 'Customer reply (YES)'
        WHEN 'verification_text' THEN 'Verification text'
        WHEN 'carrier_delivery' THEN 'Carrier delivery report'
        ELSE 'System'
      END;
    END IF;

    NEW.verified_at := now();

    INSERT INTO public.store_contact_verification_events
      (contact_id, store_id, phone, status, previous_status, verified_by, verified_by_label, verified_at, method)
    VALUES
      (NEW.id, NEW.store_id, NEW.phone, NEW.number_verification_status, OLD.number_verification_status,
       NEW.verified_by, COALESCE(v_label, 'Unknown user'), NEW.verified_at, v_method);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_contact_verification ON public.store_contacts;
CREATE TRIGGER trg_stamp_contact_verification
BEFORE UPDATE OF number_verification_status ON public.store_contacts
FOR EACH ROW EXECUTE FUNCTION public.stamp_contact_verification();

CREATE OR REPLACE VIEW public.v_store_contact_verification AS
SELECT
  c.id                              AS contact_id,
  c.store_id,
  c.phone,
  c.number_verification_status      AS status,
  c.verified_at,
  c.verified_by,
  COALESCE(NULLIF(p.name, ''), p.email, e.verified_by_label) AS verified_by_label,
  e.method                          AS verified_method
FROM public.store_contacts c
LEFT JOIN public.profiles p ON p.id = c.verified_by
LEFT JOIN LATERAL (
  SELECT ev.verified_by_label, ev.method
  FROM public.store_contact_verification_events ev
  WHERE ev.contact_id = c.id
  ORDER BY ev.verified_at DESC
  LIMIT 1
) e ON true;

GRANT SELECT ON public.v_store_contact_verification TO authenticated;