
-- ============================================================
-- FLOOR 2 — TERRITORY EXECUTION ENGINE
-- Converts territory intelligence into controlled work assignments.
-- AI is a worker, never a decider. All outcomes are audited.
-- ============================================================

-- 1) territory_tasks
-- Every action in the field is an explicit, trackable task.
-- Tasks reference addresses, have owners, and require outcomes.
CREATE TABLE public.territory_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_address_id UUID NOT NULL REFERENCES public.territory_addresses(id),
  candidate_id UUID REFERENCES public.territory_store_candidates(id),
  neighborhood_id UUID REFERENCES public.territory_neighborhoods(id),
  task_type TEXT NOT NULL CHECK (task_type IN ('scout', 'call', 'visit', 'verify', 'follow_up')),
  assigned_to_type TEXT NOT NULL CHECK (assigned_to_type IN ('ai', 'human')),
  assigned_to_id UUID,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  required_outcome TEXT NOT NULL CHECK (required_outcome IN ('interest_level', 'verification', 'promotion_request')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'blocked')),
  outcome_payload JSONB,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.territory_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tasks"
  ON public.territory_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON public.territory_tasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tasks"
  ON public.territory_tasks FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_territory_tasks_updated_at
  BEFORE UPDATE ON public.territory_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookup by neighborhood and status
CREATE INDEX idx_territory_tasks_neighborhood_status
  ON public.territory_tasks(neighborhood_id, status);
CREATE INDEX idx_territory_tasks_address
  ON public.territory_tasks(territory_address_id, status);

-- ============================================================
-- RPC: generate_territory_tasks
-- Creates tasks based on domination score gaps.
-- Never duplicates open/in_progress tasks for the same address.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_territory_tasks(
  p_neighborhood_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INT := 0;
  v_addr RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- For each address in the neighborhood that has no open/in_progress task
  FOR v_addr IN
    SELECT ta.id AS address_id, ta.discovery_status,
           EXISTS (
             SELECT 1 FROM territory_store_candidates tsc
             WHERE tsc.territory_address_id = ta.id
           ) AS has_candidate,
           (SELECT tsc.id FROM territory_store_candidates tsc
            WHERE tsc.territory_address_id = ta.id
            ORDER BY tsc.created_at DESC LIMIT 1
           ) AS latest_candidate_id
    FROM territory_addresses ta
    WHERE ta.neighborhood_id = p_neighborhood_id
      -- No open or in_progress task already exists
      AND NOT EXISTS (
        SELECT 1 FROM territory_tasks tt
        WHERE tt.territory_address_id = ta.id
        AND tt.status IN ('open', 'in_progress')
      )
      -- Only actionable statuses
      AND ta.discovery_status IN ('unknown', 'scouted')
  LOOP
    IF v_addr.discovery_status = 'unknown' THEN
      -- Unknown address → scout task
      INSERT INTO territory_tasks (
        territory_address_id, neighborhood_id, task_type,
        assigned_to_type, priority, required_outcome
      ) VALUES (
        v_addr.address_id, p_neighborhood_id, 'scout',
        'human', 'medium', 'interest_level'
      );
      v_count := v_count + 1;

    ELSIF v_addr.discovery_status = 'scouted' AND v_addr.has_candidate THEN
      -- Scouted with candidate → call task
      INSERT INTO territory_tasks (
        territory_address_id, candidate_id, neighborhood_id, task_type,
        assigned_to_type, priority, required_outcome
      ) VALUES (
        v_addr.address_id, v_addr.latest_candidate_id, p_neighborhood_id, 'call',
        'ai', 'medium', 'interest_level'
      );
      v_count := v_count + 1;

    ELSIF v_addr.discovery_status = 'scouted' AND NOT v_addr.has_candidate THEN
      -- Scouted but no candidate yet → visit task
      INSERT INTO territory_tasks (
        territory_address_id, neighborhood_id, task_type,
        assigned_to_type, priority, required_outcome
      ) VALUES (
        v_addr.address_id, p_neighborhood_id, 'visit',
        'human', 'high', 'verification'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- RPC: complete_territory_task
-- Enforces required outcome, updates address/candidate state,
-- and writes audit trail. AI may complete but CANNOT set
-- discovery_status to 'verified_store'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_territory_task(
  p_task_id UUID,
  p_outcome JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_task RECORD;
  v_new_status TEXT;
  v_interest TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_task FROM territory_tasks WHERE id = p_task_id;
  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF v_task.status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'Task is not actionable (status: %)', v_task.status;
  END IF;

  -- Validate outcome payload has required field
  IF v_task.required_outcome = 'interest_level' AND NOT (p_outcome ? 'interest_level') THEN
    RAISE EXCEPTION 'Outcome must include interest_level';
  END IF;
  IF v_task.required_outcome = 'verification' AND NOT (p_outcome ? 'is_store') THEN
    RAISE EXCEPTION 'Outcome must include is_store (boolean)';
  END IF;

  -- Mark task completed
  UPDATE territory_tasks
  SET status = 'completed',
      outcome_payload = p_outcome,
      completed_at = now()
  WHERE id = p_task_id;

  -- Update address/candidate based on outcome
  IF v_task.required_outcome = 'interest_level' THEN
    v_interest := p_outcome->>'interest_level';

    -- Update address to scouted if still unknown
    UPDATE territory_addresses
    SET discovery_status = CASE
          WHEN discovery_status = 'unknown' THEN 'scouted'
          ELSE discovery_status
        END,
        last_checked_at = now()
    WHERE id = v_task.territory_address_id;

    -- Update candidate interest if one exists
    IF v_task.candidate_id IS NOT NULL THEN
      UPDATE territory_store_candidates
      SET interest_level = v_interest,
          last_contacted_at = now()
      WHERE id = v_task.candidate_id;
    END IF;

  ELSIF v_task.required_outcome = 'verification' THEN
    IF (p_outcome->>'is_store')::boolean = true THEN
      -- AI cannot set verified_store — only scouted
      IF v_task.assigned_to_type = 'ai' THEN
        UPDATE territory_addresses
        SET discovery_status = 'scouted', last_checked_at = now()
        WHERE id = v_task.territory_address_id;
      ELSE
        -- Human can mark as scouted; promotion gate handles verified_store
        UPDATE territory_addresses
        SET discovery_status = 'scouted', last_checked_at = now()
        WHERE id = v_task.territory_address_id;
      END IF;
    ELSE
      v_new_status := COALESCE(p_outcome->>'rejection_type', 'not_a_store');
      UPDATE territory_addresses
      SET discovery_status = v_new_status, last_checked_at = now()
      WHERE id = v_task.territory_address_id;
    END IF;
  END IF;

  -- Audit log
  INSERT INTO territory_activity_log (
    territory_address_id, action_type, actor_type, actor_id, notes
  ) VALUES (
    v_task.territory_address_id,
    v_task.task_type,
    v_task.assigned_to_type,
    v_user_id,
    'Task completed: ' || v_task.task_type || ' → ' || p_outcome::text
  );
END;
$$;
