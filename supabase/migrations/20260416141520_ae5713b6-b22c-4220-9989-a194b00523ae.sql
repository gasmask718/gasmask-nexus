
-- Function to refresh leaderboard stats from actual call data
CREATE OR REPLACE FUNCTION public.refresh_va_leaderboard_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_va_id uuid;
  target_date date;
  dialed_count int;
  answered_count int;
  closed_count int;
  talk_time int;
BEGIN
  -- Determine VA and date from the trigger source
  IF TG_TABLE_NAME = 'va_call_logs' THEN
    target_va_id := COALESCE(NEW.va_id, OLD.va_id);
    target_date := COALESCE(DATE(NEW.called_at), DATE(OLD.called_at), CURRENT_DATE);
  ELSIF TG_TABLE_NAME = 'brandaro_call_logs' THEN
    target_va_id := COALESCE(NEW.called_by_user_id, OLD.called_by_user_id);
    target_date := COALESCE(DATE(NEW.call_timestamp), DATE(OLD.call_timestamp), CURRENT_DATE);
  END IF;

  IF target_va_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Aggregate from va_call_logs
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(COUNT(*) FILTER (WHERE call_status IN ('completed', 'answered', 'in-progress')), 0),
    COALESCE(COUNT(*) FILTER (WHERE disposition IN ('sold', 'contracted', 'closed', 'interested')), 0),
    COALESCE(SUM(duration_seconds), 0)
  INTO dialed_count, answered_count, closed_count, talk_time
  FROM va_call_logs
  WHERE va_id = target_va_id AND DATE(called_at) = target_date;

  -- Also aggregate from brandaro_call_logs
  SELECT
    dialed_count + COALESCE(COUNT(*), 0),
    answered_count + COALESCE(COUNT(*) FILTER (WHERE call_outcome IN ('interested', 'hot_lead', 'sold', 'callback_requested', 'send_information', 'not_interested')), 0),
    closed_count + COALESCE(COUNT(*) FILTER (WHERE call_outcome IN ('sold', 'hot_lead')), 0),
    talk_time + COALESCE(SUM(COALESCE(call_duration_seconds, call_duration, 0)), 0)
  INTO dialed_count, answered_count, closed_count, talk_time
  FROM brandaro_call_logs
  WHERE called_by_user_id = target_va_id AND DATE(call_timestamp) = target_date;

  -- Upsert into leaderboard stats
  INSERT INTO va_leaderboard_stats (va_id, session_date, calls_dialed, calls_answered, calls_closed, total_talk_time_seconds)
  VALUES (target_va_id, target_date, dialed_count, answered_count, closed_count, talk_time)
  ON CONFLICT (va_id, session_date)
  DO UPDATE SET
    calls_dialed = EXCLUDED.calls_dialed,
    calls_answered = EXCLUDED.calls_answered,
    calls_closed = EXCLUDED.calls_closed,
    total_talk_time_seconds = EXCLUDED.total_talk_time_seconds,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Add unique constraint if not exists for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'va_leaderboard_stats_va_id_session_date_key'
  ) THEN
    ALTER TABLE va_leaderboard_stats ADD CONSTRAINT va_leaderboard_stats_va_id_session_date_key UNIQUE (va_id, session_date);
  END IF;
END $$;

-- Trigger on va_call_logs
DROP TRIGGER IF EXISTS trg_refresh_leaderboard_va_call_logs ON va_call_logs;
CREATE TRIGGER trg_refresh_leaderboard_va_call_logs
  AFTER INSERT OR UPDATE ON va_call_logs
  FOR EACH ROW
  EXECUTE FUNCTION refresh_va_leaderboard_stats();

-- Trigger on brandaro_call_logs
DROP TRIGGER IF EXISTS trg_refresh_leaderboard_brandaro_call_logs ON brandaro_call_logs;
CREATE TRIGGER trg_refresh_leaderboard_brandaro_call_logs
  AFTER INSERT OR UPDATE ON brandaro_call_logs
  FOR EACH ROW
  EXECUTE FUNCTION refresh_va_leaderboard_stats();

-- Add FK to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'va_leaderboard_stats_va_id_fkey'
  ) THEN
    ALTER TABLE va_leaderboard_stats
      ADD CONSTRAINT va_leaderboard_stats_va_id_fkey
      FOREIGN KEY (va_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure RLS allows authenticated users to read leaderboard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'va_leaderboard_stats' AND policyname = 'Authenticated users can view leaderboard'
  ) THEN
    CREATE POLICY "Authenticated users can view leaderboard"
      ON va_leaderboard_stats FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
