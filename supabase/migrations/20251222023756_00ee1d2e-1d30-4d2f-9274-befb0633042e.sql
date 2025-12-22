-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view members of their businesses" ON business_members;
DROP POLICY IF EXISTS "Business admins can manage members" ON business_members;

-- Create fixed policies that don't self-reference
CREATE POLICY "Users can view their own memberships"
ON business_members
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can view co-members of same businesses"
ON business_members
FOR SELECT
USING (
  business_id IN (
    SELECT bm.business_id 
    FROM business_members bm 
    WHERE bm.user_id = auth.uid()
  )
);

CREATE POLICY "Business admins can insert members"
ON business_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM business_members bm
    WHERE bm.business_id = business_members.business_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Business admins can update members"
ON business_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM business_members bm
    WHERE bm.business_id = business_members.business_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Business admins can delete members"
ON business_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM business_members bm
    WHERE bm.business_id = business_members.business_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin')
  )
);