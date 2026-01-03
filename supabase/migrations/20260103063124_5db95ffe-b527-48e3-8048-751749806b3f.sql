-- Fix the log_simulation_mode_change function to use correct column names
CREATE OR REPLACE FUNCTION public.log_simulation_mode_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.simulation_mode_audit (
    action,
    user_id,
    previous_mode,
    new_mode,
    reason
  ) VALUES (
    'mode_change',
    auth.uid(),
    OLD.setting_value->>'mode',
    NEW.setting_value->>'mode',
    'System mode change triggered via system_settings update'
  );
  
  -- Update the last_changed_by and last_changed_at
  NEW.last_changed_by := auth.uid()::text;
  NEW.last_changed_at := now();
  
  RETURN NEW;
END;
$function$;