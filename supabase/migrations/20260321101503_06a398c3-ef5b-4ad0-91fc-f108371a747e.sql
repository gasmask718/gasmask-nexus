
-- FIX 1: Add address component columns to checklist_additional_stores
ALTER TABLE checklist_additional_stores
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

-- FIX 2: Add relationship_type columns to store_contacts
ALTER TABLE store_contacts
  ADD COLUMN IF NOT EXISTS relationship_type text,
  ADD COLUMN IF NOT EXISTS relationship_type_custom text;
