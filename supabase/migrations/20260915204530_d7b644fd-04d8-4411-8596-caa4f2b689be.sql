ALTER TABLE public.production_history DROP CONSTRAINT IF EXISTS production_history_event_type_check;
ALTER TABLE public.production_history ADD CONSTRAINT production_history_event_type_check
CHECK (event_type = ANY (ARRAY[
  'batch_created','batch_started','batch_completed','batch_cancelled','batch_updated','batch_locked','batch_reopened',
  'output_recorded','input_updated','state_transition',
  'day_closed','day_unlocked',
  'worker_assigned','worker_removed','tool_status_changed','tool_issue_reported','tool_issue_resolved',
  'return_submitted','return_received','return_rejected',
  'note_added','message_sent'
]));