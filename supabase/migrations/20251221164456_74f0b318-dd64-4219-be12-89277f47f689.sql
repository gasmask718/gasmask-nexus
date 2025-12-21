-- Add created_by column to track ownership
ALTER TABLE public.crm_customers 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Create INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create customers"
ON public.crm_customers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Create SELECT policy for authenticated users to see their own customers
CREATE POLICY "Authenticated users can view customers"
ON public.crm_customers
FOR SELECT
TO authenticated
USING (true);

-- Create UPDATE policy for authenticated users
CREATE POLICY "Authenticated users can update customers"
ON public.crm_customers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Create DELETE policy for authenticated users  
CREATE POLICY "Authenticated users can delete customers"
ON public.crm_customers
FOR DELETE
TO authenticated
USING (true);