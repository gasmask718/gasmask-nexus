-- Add location intelligence columns to wholesalers table
ALTER TABLE public.wholesalers 
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS borough text,
ADD COLUMN IF NOT EXISTS neighborhoods text[],
ADD COLUMN IF NOT EXISTS location_notes text;

-- Create index on city for filtering
CREATE INDEX IF NOT EXISTS idx_wholesalers_city ON public.wholesalers(city);
CREATE INDEX IF NOT EXISTS idx_wholesalers_state ON public.wholesalers(state);

-- Create audit table for entity changes
CREATE TABLE IF NOT EXISTS public.entity_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_changed text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  edited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.entity_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing audit logs (authenticated users can view)
CREATE POLICY "Authenticated users can view audit logs"
ON public.entity_audit_log
FOR SELECT
TO authenticated
USING (true);

-- Create policy for inserting audit logs (authenticated users can insert)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.entity_audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_entity_audit_entity ON public.entity_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_audit_created ON public.entity_audit_log(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE public.entity_audit_log IS 'Audit trail for all entity changes - stores, wholesalers, brands, etc.';