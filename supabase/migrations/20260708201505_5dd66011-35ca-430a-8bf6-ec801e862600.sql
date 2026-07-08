DO $$
DECLARE
  missing_count INT;
BEGIN
  SELECT count(*) INTO missing_count
    FROM dynasty_phone_numbers dp
   WHERE NOT EXISTS (
           SELECT 1 FROM dc_phone_numbers dc
            WHERE dc.phone_number = dp.phone_number
         )
     AND NOT EXISTS (
           SELECT 1 FROM bland_owned_numbers bo
            WHERE bo.phone_number = dp.phone_number
         );
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Safety check failed: % dynasty rows are not present in dc_phone_numbers or bland_owned_numbers. Aborting drop.', missing_count;
  END IF;
END $$;

DROP TABLE IF EXISTS public.dynasty_phone_numbers CASCADE;