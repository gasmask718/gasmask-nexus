
-- Add route_id to worker_payouts for linking payouts to routes
ALTER TABLE public.worker_payouts ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.routes(id);

-- Create function to auto-generate payout when route is completed
CREATE OR REPLACE FUNCTION public.auto_generate_route_payout()
RETURNS TRIGGER AS $$
DECLARE
  v_worker_type TEXT;
  v_stops_count INT;
  v_rate NUMERIC := 5.00; -- Base rate per stop
  v_total NUMERIC;
  v_business_id UUID;
BEGIN
  -- Only trigger on status change to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Prevent duplicate payouts
    IF EXISTS (SELECT 1 FROM public.worker_payouts WHERE route_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Determine worker type from route type
    v_worker_type := CASE WHEN NEW.type = 'biker' THEN 'biker' ELSE 'driver' END;

    -- Count completed stops
    SELECT COUNT(*) INTO v_stops_count
    FROM public.route_stops
    WHERE route_id = NEW.id AND status = 'completed';

    -- Calculate total (stops * rate)
    v_total := v_stops_count * v_rate;

    -- Get business_id from profiles
    SELECT p.business_id INTO v_business_id
    FROM public.profiles p
    WHERE p.id = NEW.assigned_to;

    -- Only create payout if there are completed stops and an assignee
    IF v_stops_count > 0 AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.worker_payouts (
        worker_id,
        worker_type,
        business_id,
        route_id,
        period_start,
        period_end,
        total_earned,
        total_to_pay,
        status
      ) VALUES (
        NEW.assigned_to,
        v_worker_type,
        COALESCE(v_business_id, '00000000-0000-0000-0000-000000000000'),
        NEW.id,
        NEW.date,
        NEW.date,
        v_total,
        v_total,
        'draft'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_auto_generate_route_payout ON public.routes;
CREATE TRIGGER trg_auto_generate_route_payout
  AFTER UPDATE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_route_payout();
