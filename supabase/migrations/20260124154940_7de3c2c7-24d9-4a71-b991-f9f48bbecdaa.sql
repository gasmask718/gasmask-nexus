-- Add is_canonical column to incident_simulations for identifying seeded data
ALTER TABLE public.incident_simulations 
ADD COLUMN IF NOT EXISTS is_canonical boolean DEFAULT false;

-- Add index for canonical simulations
CREATE INDEX IF NOT EXISTS idx_incident_simulations_canonical 
ON public.incident_simulations(is_canonical) WHERE is_canonical = true;

-- Add lock columns to forensic_replay_sessions
ALTER TABLE public.forensic_replay_sessions 
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS lock_reason text;

-- Add hash chain columns to forensic_call_frames for immutability
ALTER TABLE public.forensic_call_frames 
ADD COLUMN IF NOT EXISTS prev_hash text,
ADD COLUMN IF NOT EXISTS row_hash text;

-- Create index for locked replay sessions
CREATE INDEX IF NOT EXISTS idx_forensic_replay_sessions_locked 
ON public.forensic_replay_sessions(is_locked) WHERE is_locked = true;

-- Add trigger to prevent modification of locked replay sessions
CREATE OR REPLACE FUNCTION prevent_locked_replay_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'Cannot modify locked forensic replay session';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_locked_replay_modification ON public.forensic_replay_sessions;
CREATE TRIGGER trg_prevent_locked_replay_modification
  BEFORE UPDATE OR DELETE ON public.forensic_replay_sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_replay_modification();

-- Add trigger to prevent modification of frames in locked sessions
CREATE OR REPLACE FUNCTION prevent_locked_frame_modification()
RETURNS TRIGGER AS $$
DECLARE
  session_locked boolean;
BEGIN
  SELECT is_locked INTO session_locked 
  FROM public.forensic_replay_sessions 
  WHERE id = COALESCE(OLD.replay_session_id, NEW.replay_session_id);
  
  IF session_locked = true THEN
    RAISE EXCEPTION 'Cannot modify frames in a locked forensic replay session';
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_locked_frame_modification ON public.forensic_call_frames;
CREATE TRIGGER trg_prevent_locked_frame_modification
  BEFORE UPDATE OR DELETE ON public.forensic_call_frames
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_frame_modification();