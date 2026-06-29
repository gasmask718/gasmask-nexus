-- ============================================================
-- T6 Phase 1 — recover T3 versioning + add disposition numbering
-- ============================================================

-- 1. Fix T3 versioning trigger
--    OLD: (v_old_jsonb - 'id')  ← jsonb_populate_record leaves missing keys NULL,
--         which violated id NOT NULL on every snapshot insert.
--    NEW: replace id with a fresh UUID explicitly.
--    Also adds 'display_number' to v_strip so re-orderings don't churn versions.
CREATE OR REPLACE FUNCTION public.snapshot_version_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_current_col text := COALESCE(TG_ARGV[0], 'is_current');
  v_version_col    text := COALESCE(TG_ARGV[1], 'version');
  v_old_jsonb      jsonb;
  v_new_jsonb      jsonb;
  v_old_compare    jsonb;
  v_new_compare    jsonb;
  v_strip          text[] := ARRAY['updated_at','parent_version_id','superseded_at','superseded_by','created_by','display_number'];
  k                text;
BEGIN
  v_old_jsonb := to_jsonb(OLD);
  v_new_jsonb := to_jsonb(NEW);

  IF COALESCE((v_old_jsonb->>v_is_current_col)::bool, false) IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  v_old_compare := v_old_jsonb;
  v_new_compare := v_new_jsonb;
  FOREACH k IN ARRAY v_strip LOOP
    v_old_compare := v_old_compare - k;
    v_new_compare := v_new_compare - k;
  END LOOP;
  v_old_compare := v_old_compare - v_version_col;
  v_new_compare := v_new_compare - v_version_col;
  IF v_old_compare = v_new_compare THEN
    RETURN NEW;
  END IF;

  v_new_jsonb := v_new_jsonb
    || jsonb_build_object(
         v_version_col,        COALESCE((v_old_jsonb->>v_version_col)::int, 1) + 1,
         'parent_version_id',  OLD.id,
         v_is_current_col,     true,
         'superseded_at',      NULL,
         'superseded_by',      NULL
       );
  NEW := jsonb_populate_record(NEW, v_new_jsonb);

  -- FIX: replace id with a fresh UUID rather than stripping it
  EXECUTE format(
    'INSERT INTO %I.%I SELECT (jsonb_populate_record(NULL::%I.%I, $1)).*',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_TABLE_SCHEMA, TG_TABLE_NAME
  ) USING (
    (v_old_jsonb
      || jsonb_build_object(
           'id',             gen_random_uuid(),
           v_is_current_col, false,
           'superseded_at',  now(),
           'superseded_by',  auth.uid()
         ))
  );

  RETURN NEW;
END;
$function$;

-- 2. Add display_number column
ALTER TABLE public.dialer_disposition_codes
  ADD COLUMN IF NOT EXISTS display_number int;

-- 3. Seed display_number on the 9 current rows (sales-funnel order)
UPDATE public.dialer_disposition_codes SET display_number = 1 WHERE is_current = true AND code = 'ORDER_PLACED';
UPDATE public.dialer_disposition_codes SET display_number = 2 WHERE is_current = true AND code = 'INTERESTED';
UPDATE public.dialer_disposition_codes SET display_number = 3 WHERE is_current = true AND code = 'NEEDS_SAMPLES';
UPDATE public.dialer_disposition_codes SET display_number = 4 WHERE is_current = true AND code = 'CALL_BACK';
UPDATE public.dialer_disposition_codes SET display_number = 5 WHERE is_current = true AND code = 'OWNER_NOT_AVAILABLE';
UPDATE public.dialer_disposition_codes SET display_number = 6 WHERE is_current = true AND code = 'ALREADY_SUPPLIED';
UPDATE public.dialer_disposition_codes SET display_number = 7 WHERE is_current = true AND code = 'NOT_INTERESTED';
UPDATE public.dialer_disposition_codes SET display_number = 8 WHERE is_current = true AND code = 'WRONG_NUMBER';
UPDATE public.dialer_disposition_codes SET display_number = 9 WHERE is_current = true AND code = 'DO_NOT_CALL';

-- 4. Require display_number on current rows (historical rows may be NULL)
ALTER TABLE public.dialer_disposition_codes
  DROP CONSTRAINT IF EXISTS dialer_disposition_codes_display_number_required;
ALTER TABLE public.dialer_disposition_codes
  ADD CONSTRAINT dialer_disposition_codes_display_number_required
  CHECK (is_current = false OR display_number IS NOT NULL);

-- 5. Unique (business_id, display_number) for current rows; NULL business_id coalesced
DROP INDEX IF EXISTS public.dialer_disposition_codes_display_number_unique;
CREATE UNIQUE INDEX dialer_disposition_codes_display_number_unique
  ON public.dialer_disposition_codes (
    COALESCE(business_id, '00000000-0000-0000-0000-000000000000'::uuid),
    display_number
  )
  WHERE is_current = true;

-- 6. Tighten RLS — drop over-granted ALL policy, add scoped policies
DROP POLICY IF EXISTS "Admin access dialer_disposition_codes" ON public.dialer_disposition_codes;
DROP POLICY IF EXISTS "Admin/owner manage dispositions" ON public.dialer_disposition_codes;
DROP POLICY IF EXISTS "All roles read current dispositions" ON public.dialer_disposition_codes;

CREATE POLICY "Admin/owner manage dispositions"
  ON public.dialer_disposition_codes
  FOR ALL TO authenticated
  USING (public.is_brandaro_admin(auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.is_brandaro_admin(auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "All roles read current dispositions"
  ON public.dialer_disposition_codes
  FOR SELECT TO authenticated
  USING (is_current = true);