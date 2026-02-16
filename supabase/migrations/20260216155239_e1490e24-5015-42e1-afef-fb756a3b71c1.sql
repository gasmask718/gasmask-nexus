ALTER TABLE public.dispatch_interventions DROP CONSTRAINT dispatch_interventions_intervention_type_check;

ALTER TABLE public.dispatch_interventions ADD CONSTRAINT dispatch_interventions_intervention_type_check CHECK (intervention_type = ANY (ARRAY['reassign_route','reassign_stop','split_route','merge_route','pause_route','resume_route','cancel_route','force_complete','force_cancel','add_emergency_stop','override_capacity','escalate','ping_worker']));
