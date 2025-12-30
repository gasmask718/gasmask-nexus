-- Add revocation fields to confirmed_game_winners
ALTER TABLE public.confirmed_game_winners
ADD COLUMN IF NOT EXISTS confirmation_revoked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS revoke_reason text;

-- Create confirmation audit log table
CREATE TABLE IF NOT EXISTS public.confirmation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  action text NOT NULL, -- 'confirm', 'undo', 'reconfirm'
  previous_winner text,
  new_winner text,
  admin_user_id uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.confirmation_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for confirmation_audit_log
CREATE POLICY "Authenticated users can view audit logs"
ON public.confirmation_audit_log FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert audit logs"
ON public.confirmation_audit_log FOR INSERT
TO authenticated WITH CHECK (true);

-- Update prediction_evaluations to track evaluation validity
ALTER TABLE public.prediction_evaluations
ADD COLUMN IF NOT EXISTS is_valid boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
ADD COLUMN IF NOT EXISTS invalidation_reason text;