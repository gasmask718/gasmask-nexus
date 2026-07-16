
-- Store Review / Sign-Off system
-- 1) Events audit table
CREATE TABLE IF NOT EXISTS public.store_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  review_type text NOT NULL CHECK (review_type IN ('admin','va')),
  action text NOT NULL CHECK (action IN ('reviewed','unreviewed')),
  reviewed_by uuid,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_review_events_store ON public.store_review_events(store_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_review_events_type  ON public.store_review_events(review_type, reviewed_at DESC);

GRANT SELECT, INSERT ON public.store_review_events TO authenticated;
GRANT ALL ON public.store_review_events TO service_role;

ALTER TABLE public.store_review_events ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user
CREATE POLICY "review_events read authenticated"
  ON public.store_review_events FOR SELECT
  TO authenticated
  USING (true);

-- Insert: VA-review anyone; admin-review only admins/owners
CREATE POLICY "review_events insert (role-gated)"
  ON public.store_review_events FOR INSERT
  TO authenticated
  WITH CHECK (
    review_type = 'va'
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
  );

-- 2) Current-state convenience columns on store_master
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS reviewed_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by_admin_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_admin_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by_va boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by_va_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_va_by uuid;

CREATE INDEX IF NOT EXISTS idx_store_master_reviewed_admin ON public.store_master(reviewed_by_admin);
CREATE INDEX IF NOT EXISTS idx_store_master_reviewed_va    ON public.store_master(reviewed_by_va);

-- 3) Trigger: keep current-state columns in sync when an event lands
CREATE OR REPLACE FUNCTION public.apply_store_review_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.review_type = 'admin' THEN
    UPDATE public.store_master
       SET reviewed_by_admin    = (NEW.action = 'reviewed'),
           reviewed_by_admin_at = CASE WHEN NEW.action = 'reviewed' THEN NEW.reviewed_at ELSE NULL END,
           reviewed_by_admin_by = CASE WHEN NEW.action = 'reviewed' THEN NEW.reviewed_by ELSE NULL END
     WHERE id = NEW.store_id;
  ELSIF NEW.review_type = 'va' THEN
    UPDATE public.store_master
       SET reviewed_by_va    = (NEW.action = 'reviewed'),
           reviewed_by_va_at = CASE WHEN NEW.action = 'reviewed' THEN NEW.reviewed_at ELSE NULL END,
           reviewed_by_va_by = CASE WHEN NEW.action = 'reviewed' THEN NEW.reviewed_by ELSE NULL END
     WHERE id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_store_review_event ON public.store_review_events;
CREATE TRIGGER trg_apply_store_review_event
  AFTER INSERT ON public.store_review_events
  FOR EACH ROW EXECUTE FUNCTION public.apply_store_review_event();
