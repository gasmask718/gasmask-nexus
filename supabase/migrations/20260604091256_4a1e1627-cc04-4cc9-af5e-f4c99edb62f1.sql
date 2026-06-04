
-- 1. Vault bootstrap
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM vault.secrets WHERE name = 'service_role_key';
  IF v_count = 0 THEN
    PERFORM vault.create_secret('__BOOTSTRAP_REPLACE_ME__', 'service_role_key',
      'Service role JWT used by private.cron_post for authenticated edge function invocation from pg_cron');
  END IF;
END $$;

-- 2. Private schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres;

-- 3. Definer wrapper
CREATE OR REPLACE FUNCTION private.cron_post(fn_name text, body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions, net
AS $$
DECLARE
  v_key text;
  v_url text;
  v_req_id bigint;
  v_anon_fallback constant text :=
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbGFhcm9hc2hiZ2d5bnB2cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTI4MjAsImV4cCI6MjA3OTMyODgyMH0.agNLYbG5HnL0tUxalQtxffa5Z11J4gZSh9xzBHVMFMg';
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_key IS NULL OR v_key = '__BOOTSTRAP_REPLACE_ME__' THEN
    RAISE WARNING 'private.cron_post: vault service_role_key not set, falling back to anon JWT for fn=%', fn_name;
    v_key := v_anon_fallback;
  END IF;

  v_url := 'https://qalaaroashbggynpvqct.supabase.co/functions/v1/' || fn_name;

  SELECT net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := body
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$$;

REVOKE ALL ON FUNCTION private.cron_post(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.cron_post(text, jsonb) TO postgres;

-- 4. Rewrite every cron.job carrying a hardcoded JWT
DO $$
DECLARE
  r RECORD;
  v_fn text;
  v_body text;
  v_body_jsonb jsonb;
  v_new_cmd text;
BEGIN
  FOR r IN
    SELECT jobid, jobname, command FROM cron.job
    WHERE command LIKE '%eyJhbGciOiJIUzI1NiIs%'
  LOOP
    v_fn := substring(r.command from 'functions/v1/([a-zA-Z0-9_\-]+)');
    IF v_fn IS NULL THEN
      RAISE WARNING 'Skipping job % — cannot extract fn name', r.jobname;
      CONTINUE;
    END IF;

    v_body := substring(r.command from 'body\s*:?=\s*''(\{[^'']*\})''');
    BEGIN
      v_body_jsonb := COALESCE(v_body::jsonb, '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      v_body_jsonb := '{}'::jsonb;
    END;

    v_new_cmd := format(
      'SELECT private.cron_post(%L, %L::jsonb) AS request_id;',
      v_fn, v_body_jsonb::text
    );

    PERFORM cron.alter_job(job_id := r.jobid, command := v_new_cmd);
    RAISE NOTICE 'Rewrote cron job % -> fn=%', r.jobname, v_fn;
  END LOOP;
END $$;

-- 5. Nightly gdrive backup (05:00 UTC daily)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-gdrive-backup-incremental') THEN
    PERFORM cron.unschedule('nightly-gdrive-backup-incremental');
  END IF;
END $$;

SELECT cron.schedule(
  'nightly-gdrive-backup-incremental',
  '0 5 * * *',
  $cmd$SELECT private.cron_post('gdrive-backup', '{"action":"nightly-backup"}'::jsonb) AS request_id;$cmd$
);

-- 6. Register nightly in health_checks
INSERT INTO public.health_checks (
  check_key, kind, business, floor, label,
  cadence_expected_minutes, enabled, last_status
) VALUES (
  'cron.nightly-gdrive-backup', 'cron', 'platform', 'exports',
  'Nightly Google Drive Backup', 1440, true, 'unknown'
)
ON CONFLICT (check_key) DO UPDATE
SET cadence_expected_minutes = EXCLUDED.cadence_expected_minutes,
    label = EXCLUDED.label,
    enabled = true;
