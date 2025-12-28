-- Add missing columns for fantasy pick'em settlement
ALTER TABLE public.pick_entries 
ADD COLUMN IF NOT EXISTS decision_source text DEFAULT 'USER' CHECK (decision_source IN ('AI', 'USER')),
ADD COLUMN IF NOT EXISTS actual_result_value numeric;

-- Create improved trigger function for locking settled fantasy pick'em entries
CREATE OR REPLACE FUNCTION public.enforce_pick_entry_lock()
RETURNS TRIGGER AS $$
BEGIN
  -- If the entry was already settled, block modifications to key fields
  IF OLD.status = 'settled' AND OLD.locked_at IS NOT NULL THEN
    -- Check if any locked field is being modified
    IF NEW.side IS DISTINCT FROM OLD.side OR
       NEW.line_value IS DISTINCT FROM OLD.line_value OR
       NEW.platform IS DISTINCT FROM OLD.platform OR
       NEW.state IS DISTINCT FROM OLD.state OR
       NEW.market IS DISTINCT FROM OLD.market OR
       NEW.stake IS DISTINCT FROM OLD.stake OR
       NEW.odds IS DISTINCT FROM OLD.odds OR
       NEW.multiplier IS DISTINCT FROM OLD.multiplier OR
       NEW.result IS DISTINCT FROM OLD.result OR
       NEW.profit_loss IS DISTINCT FROM OLD.profit_loss OR
       NEW.actual_result_value IS DISTINCT FROM OLD.actual_result_value OR
       NEW.format_tag IS DISTINCT FROM OLD.format_tag THEN
      RAISE EXCEPTION 'Cannot modify locked entry. Entry was settled at %', OLD.locked_at;
    END IF;
  END IF;
  
  -- Auto-set locked_at when status changes to settled
  IF NEW.status = 'settled' AND OLD.status != 'settled' THEN
    NEW.locked_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS lock_settled_pick_entries ON public.pick_entries;
DROP TRIGGER IF EXISTS enforce_pick_entry_lock_trigger ON public.pick_entries;

CREATE TRIGGER enforce_pick_entry_lock_trigger
BEFORE UPDATE ON public.pick_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pick_entry_lock();

-- Add comment for documentation
COMMENT ON COLUMN public.pick_entries.decision_source IS 'Source of the pick decision: AI or USER';
COMMENT ON COLUMN public.pick_entries.actual_result_value IS 'Actual result value for settlement (e.g., player scored 27 points)';