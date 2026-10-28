-- Store portal delivery requests feed the EXISTING delivery-request queue (pending_route_stops, /dispatch/pending-stops)
ALTER TABLE public.pending_route_stops DROP CONSTRAINT IF EXISTS pending_route_stops_signal_source_check;
ALTER TABLE public.pending_route_stops ADD CONSTRAINT pending_route_stops_signal_source_check CHECK (signal_source IS NULL OR signal_source = ANY (ARRAY['ai_score','sell_through','brand_crm','opportunities','ai_call_outcome','sms_outcome','manual_disposition','owner_order','coverage_gap','manual','store_portal']));

ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS pending_route_stop_id uuid;

CREATE OR REPLACE FUNCTION public.delivery_request_to_pending_stop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _name text; _when text; _items text; _boxes int;
BEGIN
  SELECT name INTO _name FROM public.stores WHERE id = NEW.store_id;
  _when := CASE WHEN NEW.request_type = 'asap' THEN 'ASAP' ELSE to_char(NEW.requested_date, 'Mon DD') END;
  SELECT string_agg(coalesce(e->>'quantity', e->>'qty', '1') || ' x ' || coalesce(e->>'name', e->>'product_name', e->>'label', 'item') || coalesce(' (' || (e->>'unit') || ')', ''), ', '),
         sum(coalesce(nullif(e->>'quantity','')::numeric, nullif(e->>'qty','')::numeric, 0))::int
    INTO _items, _boxes
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.items) = 'array' THEN NEW.items ELSE '[]'::jsonb END) e;
  INSERT INTO public.pending_route_stops (store_id, store_name, signal_source, reason, source_ref, business, priority,
    urgency, requested_day, requested_window, intent_summary, recommended_boxes, status, ai_payload)
  VALUES (NEW.store_id, _name, 'store_portal',
    'Store portal delivery request — ' || _when || coalesce(' (' || NEW.time_window || ')', ''),
    'delivery_request:' || NEW.id, 'gasmask',
    CASE WHEN NEW.request_type = 'asap' THEN 5 ELSE 4 END,
    CASE WHEN NEW.request_type = 'asap' THEN 'today'
         WHEN NEW.requested_date <= current_date + 7 THEN 'this_week' ELSE 'next_week' END,
    CASE WHEN NEW.request_type = 'asap' THEN 'ASAP' ELSE NEW.requested_date::text END,
    NEW.time_window,
    coalesce(_items, 'Delivery requested') || coalesce(' — Note: ' || NEW.notes, ''),
    nullif(_boxes, 0), 'pending_approval',
    jsonb_build_object('source', 'store_portal', 'delivery_request_id', NEW.id, 'items', NEW.items, 'requested_date', NEW.requested_date))
  RETURNING id INTO _id;
  UPDATE public.delivery_requests SET pending_route_stop_id = _id WHERE id = NEW.id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_delivery_request_to_pending_stop ON public.delivery_requests;
CREATE TRIGGER trg_delivery_request_to_pending_stop AFTER INSERT ON public.delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.delivery_request_to_pending_stop();

-- Store cancels -> queue row closed
CREATE OR REPLACE FUNCTION public.delivery_request_cancel_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.pending_route_stop_id IS NOT NULL THEN
    UPDATE public.pending_route_stops SET status = 'rejected', rejection_reason = 'Cancelled by store', updated_at = now()
     WHERE id = NEW.pending_route_stop_id AND status = 'pending_approval';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_delivery_request_cancel_sync ON public.delivery_requests;
CREATE TRIGGER trg_delivery_request_cancel_sync AFTER UPDATE OF status ON public.delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.delivery_request_cancel_sync();

-- Queue approved onto a route -> request scheduled; queue rejected -> request cancelled
CREATE OR REPLACE FUNCTION public.pending_stop_to_delivery_request_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.signal_source <> 'store_portal' OR NEW.source_ref NOT LIKE 'delivery_request:%' THEN RETURN NEW; END IF;
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.delivery_requests
       SET status = 'scheduled', updated_at = now(),
           route_id = coalesce((SELECT rs.route_id FROM public.route_stops rs WHERE rs.id = NEW.route_stop_id), route_id)
     WHERE id = substr(NEW.source_ref, 18)::uuid AND status IN ('new','confirmed');
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    UPDATE public.delivery_requests SET status = 'cancelled', updated_at = now()
     WHERE id = substr(NEW.source_ref, 18)::uuid AND status IN ('new','confirmed');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pending_stop_to_delivery_request_sync ON public.pending_route_stops;
CREATE TRIGGER trg_pending_stop_to_delivery_request_sync AFTER UPDATE OF status, route_stop_id ON public.pending_route_stops
  FOR EACH ROW EXECUTE FUNCTION public.pending_stop_to_delivery_request_sync();

-- Remove the duplicate delivery_requests branch from v_route_candidates: requests now arrive via the pending_route_stops branch
DO $$
DECLARE d text; parts text[]; kept text[] := '{}'; p text;
BEGIN
  d := rtrim(pg_get_viewdef('public.v_route_candidates'::regclass), E'; \n');
  parts := string_to_array(d, 'UNION ALL');
  FOREACH p IN ARRAY parts LOOP
    IF position('delivery_requests dr' in p) = 0 THEN kept := kept || p; END IF;
  END LOOP;
  IF array_length(kept,1) = array_length(parts,1) - 1 THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.v_route_candidates AS ' || array_to_string(kept, 'UNION ALL');
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.delivery_request_to_pending_stop() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delivery_request_cancel_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pending_stop_to_delivery_request_sync() FROM PUBLIC, anon, authenticated;