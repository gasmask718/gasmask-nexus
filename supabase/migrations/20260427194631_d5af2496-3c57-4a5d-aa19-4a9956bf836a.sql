ALTER TABLE public.brandaro_va_coaching
  ADD COLUMN IF NOT EXISTS call_log_id uuid REFERENCES public.va_call_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS recommendations text[],
  ADD COLUMN IF NOT EXISTS handling_tips text[],
  ADD COLUMN IF NOT EXISTS rating integer,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_brandaro_va_coaching_va_user
  ON public.brandaro_va_coaching(va_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brandaro_va_coaching_call_log
  ON public.brandaro_va_coaching(call_log_id);

-- Tighten RLS
DROP POLICY IF EXISTS "ins_va_coach" ON public.brandaro_va_coaching;
DROP POLICY IF EXISTS "sel_va_coach" ON public.brandaro_va_coaching;

CREATE POLICY "va_view_own_coaching" ON public.brandaro_va_coaching
  FOR SELECT TO authenticated
  USING (
    va_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','owner')
    )
  );

CREATE POLICY "admins_insert_coaching" ON public.brandaro_va_coaching
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','owner')
    )
  );

CREATE POLICY "admins_update_coaching" ON public.brandaro_va_coaching
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','owner')
    )
  );

CREATE POLICY "va_acknowledge_own_coaching" ON public.brandaro_va_coaching
  FOR UPDATE TO authenticated
  USING (va_user_id = auth.uid())
  WITH CHECK (va_user_id = auth.uid());