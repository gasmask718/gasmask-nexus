
-- Sprint 1.1: Address Data Cleanup Migration (fixed)
-- SAFE: Only updates rows where city IS NULL, never overwrites existing data

-- Parse addresses with comma-separated format into city/state/zip
UPDATE store_master
SET 
    city = TRIM(SPLIT_PART(address, ',', (CARDINALITY(STRING_TO_ARRAY(address, ',')) - 1))),
    state = TRIM(SPLIT_PART(TRIM(SPLIT_PART(address, ',', CARDINALITY(STRING_TO_ARRAY(address, ',')))), ' ', 1)),
    zip = CASE 
            WHEN address ~ '[0-9]{5}$' THEN RIGHT(address, 5) 
            ELSE NULL 
          END
WHERE city IS NULL 
  AND address IS NOT NULL 
  AND address LIKE '%,%';
