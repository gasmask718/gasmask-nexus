-- Drop and recreate the get_user_businesses function
DROP FUNCTION IF EXISTS get_user_businesses(uuid);

CREATE OR REPLACE FUNCTION get_user_businesses(user_id uuid)
RETURNS TABLE (
  business_id uuid,
  business_name text,
  business_slug text,
  logo_url text,
  member_role text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as business_id,
    b.name as business_name,
    b.slug as business_slug,
    b.logo_url,
    bm.role as member_role
  FROM businesses b
  INNER JOIN business_members bm ON b.id = bm.business_id
  WHERE bm.user_id = get_user_businesses.user_id;
END;
$$;