CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone_unique 
ON brandaro_qualified_leads(phone_number)
WHERE phone_number IS NOT NULL;