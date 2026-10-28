-- Run as privileged test harness in a transaction. No rows persist.
BEGIN;
SELECT set_config('request.jwt.claims','{"sub":"6019a316-2d95-4662-997c-c47bd0b37697","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN
 PERFORM public.field_route_stop_outcome('b92c85dd-167b-4fef-b6ed-72b60ca24611','completed');
 RAISE EXCEPTION 'Cancelled route accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Route access denied' THEN RAISE; END IF; END;
END $$;
UPDATE public.routes SET status='active' WHERE id IN ('b92c85dd-167b-4fef-b6ed-72b60ca24601','b92c85dd-167b-4fef-b6ed-72b60ca24602');
UPDATE public.route_stops SET status='pending' WHERE id IN ('b92c85dd-167b-4fef-b6ed-72b60ca24611','b92c85dd-167b-4fef-b6ed-72b60ca24612');
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 n:=public.field_route_stop_outcome('b92c85dd-167b-4fef-b6ed-72b60ca24611','completed',40.67,-73.94);
 IF n<>2 THEN RAISE EXCEPTION 'Expected both MASTER/day stops complete, got %',n; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"2148a425-1dd9-4c76-9752-74e8fa62cfe3","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.field_route_stop_outcome('b92c85dd-167b-4fef-b6ed-72b60ca24611','completed');
 RAISE EXCEPTION 'Outsider accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Route access denied' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN IF public.store_portal_is_live() THEN RAISE EXCEPTION 'Portal launch lock changed'; END IF; END $$;
ROLLBACK;
