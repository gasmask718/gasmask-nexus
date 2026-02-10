
-- Territory Ingestion: Bulk import with deduplication
-- Normalizes addresses and prevents overwriting verified records

CREATE OR REPLACE FUNCTION public.ingest_territory_addresses(
  p_addresses JSONB -- array of {full_address, city, state, zip, latitude, longitude, address_type, notes}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record JSONB;
  v_inserted INT := 0;
  v_skipped INT := 0;
  v_duplicates INT := 0;
  v_normalized_address TEXT;
  v_existing_id UUID;
BEGIN
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_addresses)
  LOOP
    -- Normalize: trim, lowercase for comparison
    v_normalized_address := lower(trim(v_record->>'full_address'));
    
    -- Check for exact address match
    SELECT id INTO v_existing_id
    FROM territory_addresses
    WHERE lower(trim(full_address)) = v_normalized_address
      AND lower(trim(city)) = lower(trim(v_record->>'city'))
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      -- Never overwrite verified addresses
      v_duplicates := v_duplicates + 1;
      CONTINUE;
    END IF;
    
    -- Check lat/lng proximity (within ~50 meters)
    IF (v_record->>'latitude') IS NOT NULL AND (v_record->>'longitude') IS NOT NULL THEN
      SELECT id INTO v_existing_id
      FROM territory_addresses
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND ABS(latitude - (v_record->>'latitude')::FLOAT) < 0.0005
        AND ABS(longitude - (v_record->>'longitude')::FLOAT) < 0.0005
      LIMIT 1;
      
      IF v_existing_id IS NOT NULL THEN
        v_duplicates := v_duplicates + 1;
        CONTINUE;
      END IF;
    END IF;
    
    -- Insert new address
    INSERT INTO territory_addresses (
      full_address,
      city,
      state,
      zip,
      latitude,
      longitude,
      address_type,
      discovery_status,
      discovered_by,
      notes
    ) VALUES (
      trim(v_record->>'full_address'),
      trim(v_record->>'city'),
      trim(v_record->>'state'),
      trim(v_record->>'zip'),
      CASE WHEN v_record->>'latitude' IS NOT NULL THEN (v_record->>'latitude')::FLOAT ELSE NULL END,
      CASE WHEN v_record->>'longitude' IS NOT NULL THEN (v_record->>'longitude')::FLOAT ELSE NULL END,
      COALESCE(v_record->>'address_type', 'unknown'),
      'unknown',
      'import',
      v_record->>'notes'
    );
    
    v_inserted := v_inserted + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'duplicates', v_duplicates,
    'total', jsonb_array_length(p_addresses)
  );
END;
$$;
