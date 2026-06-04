
DO $$
DECLARE
  r RECORD;
  v_old_jwt constant text :=
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbGFhcm9hc2hiZ2d5bnB2cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTI4MjAsImV4cCI6MjA3OTMyODgyMH0.agNLYbG5HnL0tUxalQtxffa5Z11J4gZSh9xzBHVMFMg';
  -- Inline subquery returns service_role_key from vault (falls back to anon literal during bootstrap)
  v_replacement constant text :=
    '(SELECT CASE WHEN decrypted_secret = ''__BOOTSTRAP_REPLACE_ME__'' THEN ''' ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbGFhcm9hc2hiZ2d5bnB2cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTI4MjAsImV4cCI6MjA3OTMyODgyMH0.agNLYbG5HnL0tUxalQtxffa5Z11J4gZSh9xzBHVMFMg' ||
    ''' ELSE decrypted_secret END FROM vault.decrypted_secrets WHERE name = ''service_role_key'' LIMIT 1)';
  v_new_cmd text;
BEGIN
  FOR r IN SELECT jobid, jobname, command FROM cron.job WHERE command LIKE '%' || v_old_jwt || '%'
  LOOP
    -- Replace the JWT literal (with surrounding quotes) by the subquery (no quotes — it's a SQL expression)
    v_new_cmd := replace(r.command, '''' || v_old_jwt || '''', v_replacement);
    PERFORM cron.alter_job(job_id := r.jobid, command := v_new_cmd);
    RAISE NOTICE 'Patched cron job %', r.jobname;
  END LOOP;
END $$;
