
-- Add outcome_summary JSONB column to delivery_checklists
-- Stores the structured field outcome capture data
ALTER TABLE public.delivery_checklists
ADD COLUMN IF NOT EXISTS outcome_summary jsonb DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.delivery_checklists.outcome_summary IS 
'Structured field outcome capture: {contact_id, contact_name, outcome_type, payment_collected, payment_amount, payment_method, notes, captured_at, captured_by}';
