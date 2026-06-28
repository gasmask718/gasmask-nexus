
-- ============================================================
-- PHASE 1: Drop confirmed-dead table
-- ============================================================
DROP TABLE IF EXISTS public.call_scripts CASCADE;

-- ============================================================
-- PHASE 2: Versioning columns + partial unique replacement
-- ============================================================

-- brandaro_sales_script_steps
ALTER TABLE public.brandaro_sales_script_steps
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_version_id uuid NULL REFERENCES public.brandaro_sales_script_steps(id),
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS superseded_by uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.brandaro_sales_script_steps
  DROP CONSTRAINT IF EXISTS brandaro_sales_script_steps_step_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS brandaro_sales_script_steps_step_key_current_unique
  ON public.brandaro_sales_script_steps (step_key) WHERE is_current = true;

-- brandaro_closer_rebuttals
ALTER TABLE public.brandaro_closer_rebuttals
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_version_id uuid NULL REFERENCES public.brandaro_closer_rebuttals(id),
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS superseded_by uuid NULL REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS brandaro_closer_rebuttals_objection_key_current_unique
  ON public.brandaro_closer_rebuttals (objection_key) WHERE is_current = true;

-- brandaro_voice_agent_scripts (reuse script_version + is_active)
ALTER TABLE public.brandaro_voice_agent_scripts
  ADD COLUMN IF NOT EXISTS parent_version_id uuid NULL REFERENCES public.brandaro_voice_agent_scripts(id),
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS superseded_by uuid NULL REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS brandaro_voice_agent_scripts_name_current_unique
  ON public.brandaro_voice_agent_scripts (script_name) WHERE is_active = true;

-- dialer_disposition_codes
ALTER TABLE public.dialer_disposition_codes
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_version_id uuid NULL REFERENCES public.dialer_disposition_codes(id),
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS superseded_by uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.dialer_disposition_codes
  DROP CONSTRAINT IF EXISTS dialer_disposition_codes_business_id_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS dialer_disposition_codes_business_code_current_unique
  ON public.dialer_disposition_codes (business_id, code) WHERE is_current = true;

-- brandaro_closer_playbooks
ALTER TABLE public.brandaro_closer_playbooks
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_version_id uuid NULL REFERENCES public.brandaro_closer_playbooks(id),
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS superseded_by uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.brandaro_closer_playbooks
  DROP CONSTRAINT IF EXISTS brandaro_closer_playbooks_playbook_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS brandaro_closer_playbooks_playbook_key_current_unique
  ON public.brandaro_closer_playbooks (playbook_key) WHERE is_current = true;

-- ============================================================
-- Shared trigger function (TG_ARGV: is_current_col, version_col)
-- ============================================================
CREATE OR REPLACE FUNCTION public.snapshot_version_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_is_current_col text := COALESCE(TG_ARGV[0], 'is_current');
  v_version_col    text := COALESCE(TG_ARGV[1], 'version');
  v_old_jsonb      jsonb;
  v_new_jsonb      jsonb;
  v_old_compare    jsonb;
  v_new_compare    jsonb;
  v_strip          text[] := ARRAY['updated_at','parent_version_id','superseded_at','superseded_by','created_by'];
  k                text;
BEGIN
  v_old_jsonb := to_jsonb(OLD);
  v_new_jsonb := to_jsonb(NEW);

  -- Only snapshot when OLD was the current canonical row
  IF COALESCE((v_old_jsonb->>v_is_current_col)::bool, false) IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  -- No-real-change guard: strip all version-tracking + audit cols before compare
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

  -- Bump version on NEW (row stays current, keeps its id)
  v_new_jsonb := v_new_jsonb
    || jsonb_build_object(
         v_version_col,        COALESCE((v_old_jsonb->>v_version_col)::int, 1) + 1,
         'parent_version_id',  OLD.id,
         v_is_current_col,     true,
         'superseded_at',      NULL,
         'superseded_by',      NULL
       );
  NEW := jsonb_populate_record(NEW, v_new_jsonb);

  -- Insert OLD as historical snapshot (new id, marked superseded)
  EXECUTE format(
    'INSERT INTO %I.%I SELECT (jsonb_populate_record(NULL::%I.%I, $1)).*',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_TABLE_SCHEMA, TG_TABLE_NAME
  ) USING (
    ((v_old_jsonb - 'id')
      || jsonb_build_object(
           v_is_current_col, false,
           'superseded_at',  now(),
           'superseded_by',  auth.uid()
         ))
  );

  RETURN NEW;
END;
$func$;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_snapshot_version ON public.brandaro_sales_script_steps;
CREATE TRIGGER trg_snapshot_version BEFORE UPDATE ON public.brandaro_sales_script_steps
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_version_on_update('is_current','version');

DROP TRIGGER IF EXISTS trg_snapshot_version ON public.brandaro_closer_rebuttals;
CREATE TRIGGER trg_snapshot_version BEFORE UPDATE ON public.brandaro_closer_rebuttals
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_version_on_update('is_current','version');

DROP TRIGGER IF EXISTS trg_snapshot_version ON public.brandaro_voice_agent_scripts;
CREATE TRIGGER trg_snapshot_version BEFORE UPDATE ON public.brandaro_voice_agent_scripts
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_version_on_update('is_active','script_version');

DROP TRIGGER IF EXISTS trg_snapshot_version ON public.dialer_disposition_codes;
CREATE TRIGGER trg_snapshot_version BEFORE UPDATE ON public.dialer_disposition_codes
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_version_on_update('is_current','version');

DROP TRIGGER IF EXISTS trg_snapshot_version ON public.brandaro_closer_playbooks;
CREATE TRIGGER trg_snapshot_version BEFORE UPDATE ON public.brandaro_closer_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_version_on_update('is_current','version');

-- ============================================================
-- PHASE 3: script_faqs (new sibling table)
-- ============================================================
CREATE TABLE public.script_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NULL,
  display_order int NOT NULL DEFAULT 0,
  is_current boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  parent_version_id uuid NULL REFERENCES public.script_faqs(id),
  created_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz NULL,
  superseded_by uuid NULL REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.script_faqs TO authenticated;
GRANT ALL ON public.script_faqs TO service_role;

ALTER TABLE public.script_faqs ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX script_faqs_question_current_unique
  ON public.script_faqs (question) WHERE is_current = true;

CREATE POLICY "Admins manage FAQs" ON public.script_faqs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read current FAQs" ON public.script_faqs
  FOR SELECT TO authenticated
  USING (is_current = true);

CREATE TRIGGER trg_snapshot_version BEFORE UPDATE ON public.script_faqs
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_version_on_update('is_current','version');
