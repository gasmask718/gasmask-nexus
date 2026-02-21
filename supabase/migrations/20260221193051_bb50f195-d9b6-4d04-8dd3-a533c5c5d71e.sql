-- Add batch_status lifecycle column to audit_batches
ALTER TABLE public.audit_batches 
ADD COLUMN batch_status text NOT NULL DEFAULT 'open' 
CHECK (batch_status IN ('open', 'under_review', 'verified_clean', 'closed'));

-- Add closed_at and closed_by for historical integrity
ALTER TABLE public.audit_batches 
ADD COLUMN closed_at timestamptz,
ADD COLUMN closed_by uuid;