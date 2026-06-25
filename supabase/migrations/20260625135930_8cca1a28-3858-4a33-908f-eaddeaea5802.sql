
CREATE TABLE IF NOT EXISTS public.store_communication_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  sms_opt_in boolean NOT NULL DEFAULT true,
  call_opt_in boolean NOT NULL DEFAULT true,
  email_opt_in boolean NOT NULL DEFAULT true,
  quiet_hours_start time,        -- e.g. '21:00'
  quiet_hours_end time,          -- e.g. '08:00'
  timezone text NOT NULL DEFAULT 'America/New_York',
  preferred_channel text,        -- 'sms' | 'call' | 'email' | null
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_communication_preferences TO authenticated;
GRANT ALL ON public.store_communication_preferences TO service_role;

ALTER TABLE public.store_communication_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read store comm prefs"
ON public.store_communication_preferences
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'csr'::public.app_role)
  OR public.has_role(auth.uid(), 'ambassador'::public.app_role)
  OR public.has_role(auth.uid(), 'va'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
);

CREATE POLICY "Operators write store comm prefs"
ON public.store_communication_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'csr'::public.app_role)
  OR public.has_role(auth.uid(), 'ambassador'::public.app_role)
  OR public.has_role(auth.uid(), 'va'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
);

CREATE POLICY "Operators update store comm prefs"
ON public.store_communication_preferences
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'csr'::public.app_role)
  OR public.has_role(auth.uid(), 'ambassador'::public.app_role)
  OR public.has_role(auth.uid(), 'va'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
)
WITH CHECK (true);

CREATE POLICY "Admins delete store comm prefs"
ON public.store_communication_preferences
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_touch_store_comm_prefs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_store_comm_prefs ON public.store_communication_preferences;
CREATE TRIGGER trg_touch_store_comm_prefs
BEFORE UPDATE ON public.store_communication_preferences
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_store_comm_prefs();
