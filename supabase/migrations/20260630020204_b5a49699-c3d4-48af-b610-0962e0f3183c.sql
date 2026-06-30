
ALTER TABLE public.kill_switch_state DROP CONSTRAINT IF EXISTS kill_switch_state_scope_check;
ALTER TABLE public.kill_switch_state ADD CONSTRAINT kill_switch_state_scope_check
  CHECK (scope = ANY (ARRAY['global','business','business_unit','campaign']));
