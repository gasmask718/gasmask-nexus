ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_by uuid,
  ADD COLUMN IF NOT EXISTS handled_at timestamptz,
  ADD COLUMN IF NOT EXISTS handled_by uuid,
  ADD COLUMN IF NOT EXISTS handled_note text;

CREATE INDEX IF NOT EXISTS idx_comm_logs_unread_inbound
  ON public.communication_logs (created_at DESC)
  WHERE direction = 'inbound' AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_comm_logs_store_created
  ON public.communication_logs (store_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.mark_communication_read(_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (
    public.has_full_comms_access(auth.uid())
    OR EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not permitted to update communication logs';
  END IF;

  UPDATE public.communication_logs
     SET read_at = COALESCE(read_at, now()),
         read_by = COALESCE(read_by, auth.uid())
   WHERE id = ANY(_ids)
     AND direction = 'inbound'
     AND read_at IS NULL;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_call_handled(_id uuid, _note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (
    public.has_full_comms_access(auth.uid())
    OR EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not permitted to update communication logs';
  END IF;

  UPDATE public.communication_logs
     SET handled_at = now(),
         handled_by = auth.uid(),
         handled_note = COALESCE(_note, handled_note),
         follow_up_required = false
   WHERE id = _id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_communication_read(uuid[]) FROM public;
REVOKE ALL ON FUNCTION public.mark_call_handled(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_communication_read(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_call_handled(uuid, text) TO authenticated;