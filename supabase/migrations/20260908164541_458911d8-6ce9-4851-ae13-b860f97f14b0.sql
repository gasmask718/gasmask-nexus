-- 1. Dispatch now hands off instead of ending at "matched"
CREATE OR REPLACE FUNCTION public.icw_dispatch_job(_job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  j            public.icw_jobs%ROWTYPE;
  cfg          public.icw_state_config%ROWTYPE;
  gate         text;
  st           text;
  gate_col     text;
  note         text;
  cand         record;
  n_cand       int;
  rows_n       int;
  runner_up    text;
  n_declined   int;
BEGIN
  SELECT * INTO j FROM public.icw_jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'icw_dispatch_job: job % not found', _job_id;
  END IF;

  st   := upper(trim(coalesce(j.state, '')));
  gate := public.icw_category_gate(j.category);
  n_declined := coalesce(array_length(j.declined_worker_ids, 1), 0);

  ------------------------------------------------------------------
  -- LICENSING GATE (runs before any matching attempt)
  ------------------------------------------------------------------
  IF gate IS NOT NULL THEN
    SELECT * INTO cfg
    FROM public.icw_state_config c
    WHERE upper(trim(c.state)) = st OR upper(trim(coalesce(c.abbreviation, ''))) = st
    ORDER BY (upper(trim(c.state)) = st) DESC
    LIMIT 1;

    gate_col := CASE gate
      WHEN 'handyman'  THEN coalesce(cfg.handyman_license_gate,  cfg.handyman_license_status)
      ELSE                  coalesce(cfg.specialty_license_gate,
                                     CASE WHEN cfg.pest_control_license_required THEN 'pest_control_license_required' END,
                                     cfg.biohazard_license_required_notes)
    END;

    IF NOT FOUND OR cfg.verified IS DISTINCT FROM true THEN
      note := format(
        'Blocked by %s license gate: category "%s" in state "%s". %s. Gate value: %s. Confidence: %s.%s',
        gate, j.category, coalesce(nullif(st,''), '(no state on job)'),
        CASE WHEN cfg.id IS NULL THEN 'No icw_state_config row for this state'
             ELSE 'icw_state_config.verified is not true' END,
        coalesce(gate_col, '(none recorded)'),
        coalesce(cfg.confidence, '(n/a)'),
        CASE WHEN cfg.notes IS NOT NULL THEN ' Notes: ' || cfg.notes ELSE '' END
      );

      UPDATE public.icw_jobs
         SET status = 'blocked_licensing', assigned_worker_id = NULL, awaiting_response_since = NULL
       WHERE id = j.id;
      GET DIAGNOSTICS rows_n = ROW_COUNT;
      IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: status update wrote % rows for job %', rows_n, j.id; END IF;

      INSERT INTO public.icw_dispatch_log (job_id, event, note) VALUES (j.id, 'licensing_block', note);
      GET DIAGNOSTICS rows_n = ROW_COUNT;
      IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: dispatch log insert failed for job %', j.id; END IF;

      RETURN jsonb_build_object('job_id', j.id, 'status', 'blocked_licensing', 'gate', gate, 'note', note);
    END IF;
  END IF;

  ------------------------------------------------------------------
  -- MATCHING: approved + available + same state + covers category,
  -- excluding any worker who already declined this job,
  -- least-loaded first (active = awaiting_worker_response / matched / in_progress).
  ------------------------------------------------------------------
  CREATE TEMP TABLE IF NOT EXISTS _icw_cands (
    id uuid, full_name text, active_load int, rn int
  ) ON COMMIT DROP;
  DELETE FROM _icw_cands WHERE true;

  INSERT INTO _icw_cands (id, full_name, active_load, rn)
  SELECT w.id, w.full_name, l.active_load,
         row_number() OVER (ORDER BY l.active_load ASC, w.created_at ASC, w.id ASC)
  FROM public.icw_workers w
  CROSS JOIN LATERAL (
    SELECT count(*)::int AS active_load
    FROM public.icw_jobs aj
    WHERE aj.assigned_worker_id = w.id
      AND aj.status IN ('awaiting_worker_response','matched','in_progress')
  ) l
  WHERE w.approved = true
    AND public.icw_worker_is_available(w.availability)
    AND upper(trim(coalesce(w.state,''))) = st
    AND st <> ''
    AND NOT (w.id = ANY (j.declined_worker_ids))
    AND EXISTS (SELECT 1 FROM unnest(w.category_groups) g WHERE lower(trim(g)) = lower(trim(j.category)));

  SELECT count(*) INTO n_cand FROM _icw_cands;

  IF n_cand = 0 THEN
    note := format('No worker available. Searched: state="%s", category="%s", approved=true, available=true.%s%s',
                   coalesce(nullif(st,''), '(no state on job)'), j.category,
                   CASE WHEN st = '' THEN ' Job has no state — cannot search.' ELSE '' END,
                   CASE WHEN n_declined > 0
                        THEN format(' %s worker(s) excluded because they already declined this job.', n_declined)
                        ELSE '' END);

    UPDATE public.icw_jobs
       SET status = 'unmatched', assigned_worker_id = NULL, awaiting_response_since = NULL
     WHERE id = j.id;
    GET DIAGNOSTICS rows_n = ROW_COUNT;
    IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: status update wrote % rows for job %', rows_n, j.id; END IF;

    INSERT INTO public.icw_dispatch_log (job_id, event, note) VALUES (j.id, 'no_worker_available', note);
    GET DIAGNOSTICS rows_n = ROW_COUNT;
    IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: dispatch log insert failed for job %', j.id; END IF;

    RETURN jsonb_build_object('job_id', j.id, 'status', 'unmatched', 'note', note);
  END IF;

  SELECT * INTO cand FROM _icw_cands WHERE rn = 1;

  IF n_cand = 1 THEN
    note := format('Offered to worker %s (%s) — only eligible candidate for state="%s", category="%s".',
                   cand.id, cand.full_name, st, j.category);
  ELSE
    SELECT string_agg(format('%s=%s active', full_name, active_load), ', ' ORDER BY rn)
      INTO runner_up FROM _icw_cands WHERE rn > 1 AND rn <= 6;
    note := format('Offered to worker %s (%s) — %s candidates for state="%s", category="%s"; chosen for lowest active load (%s active job(s)). Others: %s.%s',
                   cand.id, cand.full_name, n_cand, st, j.category, cand.active_load, coalesce(runner_up, '(none)'),
                   CASE WHEN EXISTS (SELECT 1 FROM _icw_cands WHERE rn > 1 AND active_load = cand.active_load)
                        THEN ' Tie on load broken by earliest worker record.' ELSE '' END);
  END IF;

  IF n_declined > 0 THEN
    note := note || format(' %s worker(s) excluded because they already declined this job.', n_declined);
  END IF;

  UPDATE public.icw_jobs
     SET status = 'awaiting_worker_response',
         assigned_worker_id = cand.id,
         awaiting_response_since = now()
   WHERE id = j.id;
  GET DIAGNOSTICS rows_n = ROW_COUNT;
  IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: status update wrote % rows for job %', rows_n, j.id; END IF;

  INSERT INTO public.icw_dispatch_log (job_id, event, note) VALUES (j.id, 'awaiting_response', note);
  GET DIAGNOSTICS rows_n = ROW_COUNT;
  IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: dispatch log insert failed for job %', j.id; END IF;

  RETURN jsonb_build_object('job_id', j.id, 'status', 'awaiting_worker_response',
                            'assigned_worker_id', cand.id, 'candidates', n_cand, 'note', note);
END;
$function$;

-- 2. Worker accept / decline (caller must own the worker record)
CREATE OR REPLACE FUNCTION public.icw_worker_respond(_job_id uuid, _accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  w       public.icw_workers%ROWTYPE;
  j       public.icw_jobs%ROWTYPE;
  rows_n  int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'icw_worker_respond: not signed in';
  END IF;

  SELECT * INTO w FROM public.icw_workers WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'icw_worker_respond: no ICW worker record linked to this login';
  END IF;
  IF w.approved IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'icw_worker_respond: worker is not approved';
  END IF;

  SELECT * INTO j FROM public.icw_jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'icw_worker_respond: job % not found', _job_id;
  END IF;
  IF j.assigned_worker_id IS DISTINCT FROM w.id THEN
    RAISE EXCEPTION 'icw_worker_respond: job % is not assigned to you', _job_id;
  END IF;
  IF j.status <> 'awaiting_worker_response' THEN
    RAISE EXCEPTION 'icw_worker_respond: job % is % — it is no longer awaiting your response', _job_id, j.status;
  END IF;

  IF _accept THEN
    UPDATE public.icw_jobs
       SET status = 'matched', awaiting_response_since = NULL
     WHERE id = j.id;
    GET DIAGNOSTICS rows_n = ROW_COUNT;
    IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_worker_respond: accept wrote % rows', rows_n; END IF;

    INSERT INTO public.icw_dispatch_log (job_id, event, note)
    VALUES (j.id, 'worker_accepted',
            format('Worker %s (%s) accepted the job.', w.id, w.full_name));

    RETURN jsonb_build_object('job_id', j.id, 'status', 'matched', 'worker_id', w.id);
  END IF;

  UPDATE public.icw_jobs
     SET status = 'pending',
         assigned_worker_id = NULL,
         awaiting_response_since = NULL,
         declined_worker_ids = (
           SELECT array_agg(DISTINCT x) FROM unnest(j.declined_worker_ids || w.id) x
         )
   WHERE id = j.id;
  GET DIAGNOSTICS rows_n = ROW_COUNT;
  IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_worker_respond: decline wrote % rows', rows_n; END IF;

  INSERT INTO public.icw_dispatch_log (job_id, event, note)
  VALUES (j.id, 'worker_declined',
          format('Worker %s (%s) declined the job — excluded from re-dispatch.', w.id, w.full_name));

  RETURN jsonb_build_object('job_id', j.id, 'status', 'pending', 'declined_by', w.id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.icw_worker_respond(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.icw_worker_respond(uuid, boolean) TO authenticated;

-- 3. Timeout safety net (called by a scheduled job)
CREATE OR REPLACE FUNCTION public.icw_expire_worker_responses(_minutes int DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r       record;
  n       int := 0;
BEGIN
  FOR r IN
    SELECT id, assigned_worker_id, declined_worker_ids, awaiting_response_since
    FROM public.icw_jobs
    WHERE status = 'awaiting_worker_response'
      AND awaiting_response_since IS NOT NULL
      AND awaiting_response_since < now() - make_interval(mins => _minutes)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.icw_jobs
       SET status = 'pending',
           assigned_worker_id = NULL,
           awaiting_response_since = NULL,
           declined_worker_ids = CASE
             WHEN r.assigned_worker_id IS NULL THEN r.declined_worker_ids
             ELSE (SELECT array_agg(DISTINCT x) FROM unnest(r.declined_worker_ids || r.assigned_worker_id) x)
           END
     WHERE id = r.id;

    INSERT INTO public.icw_dispatch_log (job_id, event, note)
    VALUES (r.id, 'worker_response_timeout',
            format('No response from worker %s within %s minutes (offered %s) — auto-declined and returned to dispatch; worker excluded from re-match.',
                   coalesce(r.assigned_worker_id::text, '(none)'), _minutes, r.awaiting_response_since));
    n := n + 1;
  END LOOP;

  RETURN jsonb_build_object('expired', n, 'threshold_minutes', _minutes);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.icw_expire_worker_responses(int) FROM public, anon, authenticated;

-- 4. Worker-scoped read policy (in addition to the existing staff policy)
DROP POLICY IF EXISTS "Workers see their own icw_jobs" ON public.icw_jobs;
CREATE POLICY "Workers see their own icw_jobs"
ON public.icw_jobs FOR SELECT TO authenticated
USING (
  assigned_worker_id IN (SELECT id FROM public.icw_workers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Workers see their own icw_workers row" ON public.icw_workers;
CREATE POLICY "Workers see their own icw_workers row"
ON public.icw_workers FOR SELECT TO authenticated
USING (user_id = auth.uid());