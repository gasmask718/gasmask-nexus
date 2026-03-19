UPDATE brandaro_qualified_leads
SET 
  website_status = 'no_website',
  has_website = false
WHERE has_website IS NULL
   OR has_website = true
   OR website_status IS NULL
   OR website_status != 'no_website';