-- ─────────────────────────────────────────────────────────────
-- 1. Canonical "is this store assigned to this field worker?" rule
--    Explicit assignment (ambassador or driver) OR an active route stop
--    within the last 30 days.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.field_worker_has_store(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND _store_id IS NOT NULL AND (
    -- Ambassador: explicit assignment row
    EXISTS (
      SELECT 1
      FROM public.ambassador_assignments aa
      JOIN public.ambassadors a ON a.id = aa.ambassador_id
      WHERE a.user_id = _user_id
        AND aa.store_id = _store_id
        AND aa.active IS TRUE
        AND aa.unassigned_at IS NULL
    )
    -- Ambassador: legacy pointer on the store record
    OR EXISTS (
      SELECT 1
      FROM public.store_master sm
      JOIN public.ambassadors a ON a.id = sm.assigned_ambassador_id
      WHERE sm.id = _store_id
        AND a.user_id = _user_id
    )
    -- Driver / biker: explicit assignment (driver_id may be a drivers.id or a user id)
    OR EXISTS (
      SELECT 1
      FROM public.driver_assignments da
      WHERE da.store_id = _store_id
        AND da.is_active IS TRUE
        AND (
          da.driver_id = _user_id
          OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = da.driver_id AND d.user_id = _user_id)
        )
    )
    -- Driver / biker: store sits on a route assigned to them in the last 30 days
    OR EXISTS (
      SELECT 1
      FROM public.route_stops rs
      JOIN public.routes r ON r.id = rs.route_id
      WHERE rs.store_id = _store_id
        AND r.assigned_to = _user_id
        AND r.date >= (CURRENT_DATE - INTERVAL '30 days')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.field_worker_has_store(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.field_worker_has_store(uuid, uuid) TO authenticated, service_role;

-- Convenience: the full assigned-store list for the calling user
CREATE OR REPLACE FUNCTION public.my_field_store_ids()
RETURNS TABLE (store_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT aa.store_id
    FROM public.ambassador_assignments aa
    JOIN public.ambassadors a ON a.id = aa.ambassador_id
   WHERE a.user_id = auth.uid() AND aa.active IS TRUE AND aa.unassigned_at IS NULL AND aa.store_id IS NOT NULL
  UNION
  SELECT sm.id
    FROM public.store_master sm
    JOIN public.ambassadors a ON a.id = sm.assigned_ambassador_id
   WHERE a.user_id = auth.uid()
  UNION
  SELECT da.store_id
    FROM public.driver_assignments da
   WHERE da.is_active IS TRUE AND da.store_id IS NOT NULL
     AND (da.driver_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = da.driver_id AND d.user_id = auth.uid()))
  UNION
  SELECT rs.store_id
    FROM public.route_stops rs
    JOIN public.routes r ON r.id = rs.route_id
   WHERE r.assigned_to = auth.uid()
     AND r.date >= (CURRENT_DATE - INTERVAL '30 days')
     AND rs.store_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.my_field_store_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_field_store_ids() TO authenticated, service_role;

-- Elevated = full phone-log visibility (unchanged behaviour for these roles)
CREATE OR REPLACE FUNCTION public.has_full_comms_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'owner'::app_role)
      OR public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'csr'::app_role)
      OR public.has_role(_user_id, 'va'::app_role);
$$;

REVOKE ALL ON FUNCTION public.has_full_comms_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_full_comms_access(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 2. Replace the unscoped field-staff SELECT policy on the phone log.
--    Previously: any ambassador/driver/biker/employee could read EVERY row.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "communication_logs_select_operators" ON public.communication_logs;

CREATE POLICY "comm_logs_select_elevated"
ON public.communication_logs FOR SELECT TO authenticated
USING (public.has_full_comms_access(auth.uid()));

CREATE POLICY "comm_logs_select_field_assigned_stores"
ON public.communication_logs FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'ambassador'::app_role)
    OR public.has_role(auth.uid(), 'driver'::app_role)
    OR public.has_role(auth.uid(), 'biker'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
  )
  AND store_id IS NOT NULL
  AND public.field_worker_has_store(auth.uid(), store_id)
);

-- Field staff may only log a conversation against a store assigned to them.
DROP POLICY IF EXISTS "communication_logs_insert_operators" ON public.communication_logs;

CREATE POLICY "comm_logs_insert_scoped"
ON public.communication_logs FOR INSERT TO authenticated
WITH CHECK (
  public.has_full_comms_access(auth.uid())
  OR (store_id IS NOT NULL AND public.field_worker_has_store(auth.uid(), store_id))
);

-- ─────────────────────────────────────────────────────────────
-- 3. Portal-safe view: same RLS (security_invoker), recordings stripped.
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_field_store_comms;

CREATE VIEW public.v_field_store_comms
WITH (security_invoker = on) AS
SELECT
  cl.id,
  cl.store_id,
  cl.contact_id,
  cl.channel,
  cl.call_type,
  cl.direction,
  cl.status,
  cl.delivery_status,
  cl.outcome,
  cl.summary,
  cl.message_content,
  cl.notes,
  cl.transcription,
  cl.call_duration,
  cl.duration_seconds,
  cl.sender_phone,
  cl.recipient_phone,
  cl.started_at,
  cl.answered_at,
  cl.ended_at,
  cl.sent_at,
  cl.created_at,
  cl.created_by,
  cl.ambassador_id,
  cl.driver_id,
  cl.performed_by,
  cl.event_type,
  cl.thread_id
  -- recording_url, media_urls and transcript deliberately excluded:
  -- recordings stay owner/admin/VA only.
FROM public.communication_logs cl;

GRANT SELECT ON public.v_field_store_comms TO authenticated;
GRANT ALL ON public.v_field_store_comms TO service_role;