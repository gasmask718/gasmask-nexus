-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Only admins can modify products" ON products;

-- Create proper RLS policies for products
-- SELECT: Anyone authenticated can view products
CREATE POLICY "products_select_authenticated"
ON products FOR SELECT
TO authenticated
USING (true);

-- INSERT: Any authenticated user can create products
CREATE POLICY "products_insert_authenticated"
ON products FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Any authenticated user can update products
CREATE POLICY "products_update_authenticated"
ON products FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- DELETE: Any authenticated user can delete products
CREATE POLICY "products_delete_authenticated"
ON products FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Make brand_id nullable to allow products without brand initially
-- (it's already nullable based on schema check)

-- Drop the old select policy if it exists
DROP POLICY IF EXISTS "Anyone can view products" ON products;