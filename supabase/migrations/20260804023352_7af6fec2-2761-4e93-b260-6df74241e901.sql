CREATE TABLE public.comms_dispatch_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  released_by uuid REFERENCES auth.users(id),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.comms_dispatch_holds TO authenticated;
GRANT ALL ON public.comms_dispatch_holds TO service_role;

ALTER TABLE public.comms_dispatch_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read comms holds"
  ON public.comms_dispatch_holds FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_comms_dispatch_holds_updated_at
  BEFORE UPDATE ON public.comms_dispatch_holds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.comms_dispatch_holds (entity_type, active, reason)
VALUES ('invoice', true, 'HOLD: awaiting David''s confirmation that billing/payment_status data is reconciled before any invoice follow-up leaves the queue.');

CREATE OR REPLACE FUNCTION public.enforce_comms_dispatch_hold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND OLD.status = 'pending'
     AND EXISTS (
       SELECT 1 FROM public.comms_dispatch_holds h
       WHERE h.entity_type = NEW.entity_type AND h.active = true
     )
  THEN
    RAISE EXCEPTION 'Communication dispatch hold active for entity_type "%" — row % cannot be dispatched or actioned until the hold is released.', NEW.entity_type, NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_comms_dispatch_hold_trg
  BEFORE UPDATE ON public.ai_communication_queue
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comms_dispatch_hold();