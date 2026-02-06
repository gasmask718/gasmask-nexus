
-- Drop the problematic ALL policy
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.user_invitations;

-- Create separate policies with proper WITH CHECK for mutations
CREATE POLICY "Admins can select invitations"
ON public.user_invitations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can insert invitations"
ON public.user_invitations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can update invitations"
ON public.user_invitations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can delete invitations"
ON public.user_invitations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);
