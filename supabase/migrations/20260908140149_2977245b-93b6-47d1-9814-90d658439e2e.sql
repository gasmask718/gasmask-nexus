-- 1. New job statuses (additive)
ALTER TYPE public.icw_job_status ADD VALUE IF NOT EXISTS 'blocked_licensing';
ALTER TYPE public.icw_job_status ADD VALUE IF NOT EXISTS 'unmatched';

-- 2. Which gate (if any) a category falls under. Case-insensitive keyword match so
--    both the internal taxonomy ("Handyman") and booking-site labels
--    ("Handyman & Repair") resolve the same way.
CREATE OR REPLACE FUNCTION public.icw_category_gate(_category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _category IS NULL THEN NULL
    WHEN lower(_category) ~ '(biohazard|hoarder|water damage|fire damage|restoration|pest|mold)' THEN 'specialty'
    WHEN lower(_category) ~ '(handyman|repair)' THEN 'handyman'
    ELSE NULL
  END
$$;

-- 3. Worker availability is free text today; normalise it here in ONE place.
CREATE OR REPLACE FUNCTION public.icw_worker_is_available(_availability text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(trim(_availability), '')) IN ('true','yes','y','available','active','open','1')
$$;

-- 4. Dispatch: licensing gate FIRST, then load-balanced matching.
CREATE OR REPLACE FUNCTION public.icw_dispatch_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  SELECT * INTO j FROM public.icw_jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'icw_dispatch_job: job % not found', _job_id;
  END IF;

  st   := upper(trim(coalesce(j.state, '')));
  gate := public.icw_category_gate(j.category);

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

      UPDATE public.icw_jobs SET status = 'blocked_licensing', assigned_worker_id = NULL WHERE id = j.id;
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
  -- least-loaded first (active = matched / in_progress), oldest worker as tiebreak.
  ------------------------------------------------------------------
  CREATE TEMP TABLE IF NOT EXISTS _icw_cands (
    id uuid, full_name text, active_load int, rn int
  ) ON COMMIT DROP;
  DELETE FROM _icw_cands;

  INSERT INTO _icw_cands (id, full_name, active_load, rn)
  SELECT w.id, w.full_name, l.active_load,
         row_number() OVER (ORDER BY l.active_load ASC, w.created_at ASC, w.id ASC)
  FROM public.icw_workers w
  CROSS JOIN LATERAL (
    SELECT count(*)::int AS active_load
    FROM public.icw_jobs aj
    WHERE aj.assigned_worker_id = w.id AND aj.status IN ('matched','in_progress')
  ) l
  WHERE w.approved = true
    AND public.icw_worker_is_available(w.availability)
    AND upper(trim(coalesce(w.state,''))) = st
    AND st <> ''
    AND EXISTS (SELECT 1 FROM unnest(w.category_groups) g WHERE lower(trim(g)) = lower(trim(j.category)));

  SELECT count(*) INTO n_cand FROM _icw_cands;

  IF n_cand = 0 THEN
    note := format('No worker available. Searched: state="%s", category="%s", approved=true, available=true.%s',
                   coalesce(nullif(st,''), '(no state on job)'), j.category,
                   CASE WHEN st = '' THEN ' Job has no state — cannot search.' ELSE '' END);

    UPDATE public.icw_jobs SET status = 'unmatched', assigned_worker_id = NULL WHERE id = j.id;
    GET DIAGNOSTICS rows_n = ROW_COUNT;
    IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: status update wrote % rows for job %', rows_n, j.id; END IF;

    INSERT INTO public.icw_dispatch_log (job_id, event, note) VALUES (j.id, 'no_worker_available', note);
    GET DIAGNOSTICS rows_n = ROW_COUNT;
    IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: dispatch log insert failed for job %', j.id; END IF;

    RETURN jsonb_build_object('job_id', j.id, 'status', 'unmatched', 'note', note);
  END IF;

  SELECT * INTO cand FROM _icw_cands WHERE rn = 1;

  IF n_cand = 1 THEN
    note := format('Matched worker %s (%s) — only eligible candidate for state="%s", category="%s".',
                   cand.id, cand.full_name, st, j.category);
  ELSE
    SELECT string_agg(format('%s=%s active', full_name, active_load), ', ' ORDER BY rn)
      INTO runner_up FROM _icw_cands WHERE rn > 1 AND rn <= 6;
    note := format('Matched worker %s (%s) — %s candidates for state="%s", category="%s"; chosen for lowest active load (%s active job(s)). Others: %s.%s',
                   cand.id, cand.full_name, n_cand, st, j.category, cand.active_load, coalesce(runner_up, '(none)'),
                   CASE WHEN EXISTS (SELECT 1 FROM _icw_cands WHERE rn > 1 AND active_load = cand.active_load)
                        THEN ' Tie on load broken by earliest worker record.' ELSE '' END);
  END IF;

  UPDATE public.icw_jobs SET status = 'matched', assigned_worker_id = cand.id WHERE id = j.id;
  GET DIAGNOSTICS rows_n = ROW_COUNT;
  IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: status update wrote % rows for job %', rows_n, j.id; END IF;

  INSERT INTO public.icw_dispatch_log (job_id, event, note) VALUES (j.id, 'matched', note);
  GET DIAGNOSTICS rows_n = ROW_COUNT;
  IF rows_n <> 1 THEN RAISE EXCEPTION 'icw_dispatch_job: dispatch log insert failed for job %', j.id; END IF;

  RETURN jsonb_build_object('job_id', j.id, 'status', 'matched', 'assigned_worker_id', cand.id, 'candidates', n_cand, 'note', note);
END;
$$;

REVOKE ALL ON FUNCTION public.icw_dispatch_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.icw_dispatch_job(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.icw_category_gate(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.icw_category_gate(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.icw_worker_is_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.icw_worker_is_available(text) TO authenticated, service_role;

-- 5. Auto-run on insert as pending, or whenever status is reset to pending.
CREATE OR REPLACE FUNCTION public.icw_jobs_auto_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF; -- the function's own UPDATE must not re-enter
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending') THEN
    PERFORM public.icw_dispatch_job(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS icw_jobs_auto_dispatch ON public.icw_jobs;
CREATE TRIGGER icw_jobs_auto_dispatch
AFTER INSERT OR UPDATE OF status ON public.icw_jobs
FOR EACH ROW EXECUTE FUNCTION public.icw_jobs_auto_dispatch();