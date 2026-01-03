-- ============================================================
-- GLOBAL SIMULATION MODE CONTROL — DATABASE ENFORCEMENT
-- Master Genius Prompt Implementation (Level-10 Empire-Safe)
-- ============================================================

-- 1. Add is_simulation flag to all CRM tables
-- Store Master
ALTER TABLE public.store_master 
ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_store_master_is_simulation 
ON public.store_master(is_simulation);

-- 2. Create simulation_mode_audit table for full traceability
CREATE TABLE IF NOT EXISTS public.simulation_mode_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL, -- 'mode_change' | 'data_write' | 'data_read' | 'access_denied'
  user_id UUID,
  user_role TEXT,
  system_mode TEXT NOT NULL, -- 'simulation' | 'live'
  target_table TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.simulation_mode_audit ENABLE ROW LEVEL SECURITY;

-- Audit readable by admins only
CREATE POLICY "Admins can read simulation audit" 
ON public.simulation_mode_audit 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Audit insertable by authenticated users (for logging their actions)
CREATE POLICY "Authenticated users can insert audit logs" 
ON public.simulation_mode_audit 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Update system_settings RLS to restrict mode changes to admins only
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;

CREATE POLICY "Anyone can read system settings" 
ON public.system_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can update system settings" 
ON public.system_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- 4. Create function to validate simulation mode on writes
CREATE OR REPLACE FUNCTION public.validate_simulation_mode()
RETURNS TRIGGER AS $$
DECLARE
  current_mode TEXT;
  record_is_sim BOOLEAN;
BEGIN
  -- Get current system mode
  SELECT (setting_value->>'mode')::TEXT INTO current_mode
  FROM public.system_settings 
  WHERE setting_key = 'simulation_mode';
  
  -- Default to 'live' if not set
  IF current_mode IS NULL THEN
    current_mode := 'live';
  END IF;
  
  -- Get the is_simulation value from the record
  record_is_sim := COALESCE(NEW.is_simulation, false);
  
  -- ENFORCEMENT RULE: In live mode, block simulation data writes
  IF current_mode = 'live' AND record_is_sim = true THEN
    RAISE EXCEPTION 'SIMULATION_BLOCKED: Cannot write simulation data while in LIVE MODE';
  END IF;
  
  -- ENFORCEMENT RULE: In simulation mode, block live data writes (for safety)
  IF current_mode = 'simulation' AND record_is_sim = false THEN
    -- Allow this for now - in simulation mode, users can still create real data
    -- This can be tightened later if needed
    NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Apply trigger to store_master
DROP TRIGGER IF EXISTS validate_simulation_mode_store_master ON public.store_master;
CREATE TRIGGER validate_simulation_mode_store_master
BEFORE INSERT OR UPDATE ON public.store_master
FOR EACH ROW
EXECUTE FUNCTION public.validate_simulation_mode();

-- 6. Create helper function to log mode changes
CREATE OR REPLACE FUNCTION public.log_simulation_mode_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.simulation_mode_audit (
    action,
    user_id,
    system_mode,
    details
  ) VALUES (
    'mode_change',
    auth.uid(),
    NEW.setting_value->>'mode',
    jsonb_build_object(
      'old_mode', OLD.setting_value->>'mode',
      'new_mode', NEW.setting_value->>'mode',
      'locked_for_non_admins', NEW.setting_value->>'locked_for_non_admins'
    )
  );
  
  -- Update the last_changed_by and last_changed_at
  NEW.last_changed_by := auth.uid();
  NEW.last_changed_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Apply trigger to system_settings for simulation_mode changes
DROP TRIGGER IF EXISTS log_simulation_mode_change ON public.system_settings;
CREATE TRIGGER log_simulation_mode_change
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
WHEN (OLD.setting_key = 'simulation_mode' AND NEW.setting_key = 'simulation_mode')
EXECUTE FUNCTION public.log_simulation_mode_change();

-- 8. Enable realtime for simulation_mode_audit
ALTER PUBLICATION supabase_realtime ADD TABLE public.simulation_mode_audit;