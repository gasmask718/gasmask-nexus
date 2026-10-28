-- Guard ran as the caller and called ambassador_has_store_access (not executable by authenticated) -> store cancels errored.
-- It also blocked the internal queue-link update made by the insert trigger. Run as definer; skip nested trigger writes.
CREATE OR REPLACE FUNCTION public.delivery_requests_guard_store_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public.is_store_user_for(auth.uid(), NEW.store_id)
     AND NOT public.is_staff(auth.uid())
     AND NOT public.ambassador_has_store_access(auth.uid(), NEW.store_id) THEN
    IF OLD.status <> 'new' OR NEW.status <> 'cancelled'
       OR NEW.store_id IS DISTINCT FROM OLD.store_id
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.request_type IS DISTINCT FROM OLD.request_type
       OR NEW.requested_date IS DISTINCT FROM OLD.requested_date
       OR NEW.time_window IS DISTINCT FROM OLD.time_window
       OR NEW.items IS DISTINCT FROM OLD.items
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.pending_route_stop_id IS DISTINCT FROM OLD.pending_route_stop_id
       OR NEW.route_id IS DISTINCT FROM OLD.route_id
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      RAISE EXCEPTION 'Stores can only cancel a new delivery request';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.delivery_requests_guard_store_update() FROM PUBLIC, anon, authenticated;