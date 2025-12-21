-- Add INSERT policy for authenticated users to create companies
-- Users can create companies where they are the creator
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for users who created the company
CREATE POLICY "Users can update their own companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (created_by = auth.uid()::text OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (created_by = auth.uid()::text OR has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for users who created the company (or admins)
CREATE POLICY "Users can delete their own companies"
ON public.companies
FOR DELETE
TO authenticated
USING (created_by = auth.uid()::text OR has_role(auth.uid(), 'admin'::app_role));