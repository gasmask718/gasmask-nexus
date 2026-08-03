-- ============================================================
-- Borough derivation: one shared source of truth
-- Ladder: neighborhood_zip_lookup -> zip range -> city -> address text
-- ============================================================

CREATE OR REPLACE FUNCTION public.derive_borough_name(
  _city text,
  _zip text,
  _address text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_zip5   text;
  v_city   text := upper(btrim(coalesce(_city, '')));
  v_addr   text := upper(coalesce(_address, ''));
  v_boro   text;
BEGIN
  -- Zip from the zip column, else the first plausible zip inside the address.
  v_zip5 := NULLIF(substring(regexp_replace(coalesce(_zip, ''), '[^0-9]', '', 'g') FROM 1 FOR 5), '');
  IF v_zip5 IS NULL OR length(v_zip5) <> 5 THEN
    v_zip5 := (regexp_match(coalesce(_address, ''), '\y(0[78][0-9]{3}|1[01][0-9]{3})\y'))[1];
  END IF;

  -- Tier 1: curated zip lookup wins when present.
  IF v_zip5 IS NOT NULL THEN
    SELECT n.boro INTO v_boro
    FROM public.neighborhood_zip_lookup n
    WHERE n.zip_code = v_zip5
    LIMIT 1;
    IF v_boro IS NOT NULL THEN
      RETURN v_boro;
    END IF;
  END IF;

  -- Tier 2: USPS zip ranges.
  IF v_zip5 ~ '^[0-9]{5}$' THEN
    v_boro := CASE
      WHEN v_zip5::int BETWEEN 10001 AND 10299 THEN 'Manhattan'
      WHEN v_zip5::int BETWEEN 10301 AND 10314 THEN 'Staten Island'
      WHEN v_zip5::int BETWEEN 10451 AND 10475 THEN 'Bronx'
      WHEN v_zip5::int BETWEEN 11201 AND 11256 THEN 'Brooklyn'
      WHEN v_zip5::int BETWEEN 11004 AND 11109 THEN 'Queens'
      WHEN v_zip5::int BETWEEN 11351 AND 11499 THEN 'Queens'
      WHEN v_zip5::int BETWEEN 11690 AND 11697 THEN 'Queens'
      WHEN v_zip5::int BETWEEN 11001 AND 11003 THEN 'Long Island'
      WHEN v_zip5::int BETWEEN 11010 AND 11198 THEN 'Long Island'
      WHEN v_zip5::int BETWEEN 11501 AND 11599 THEN 'Long Island'
      WHEN v_zip5::int BETWEEN 11701 AND 11980 THEN 'Long Island'
      WHEN v_zip5::int BETWEEN  7000 AND  8999 THEN 'New Jersey'
      ELSE NULL
    END;
    IF v_boro IS NOT NULL THEN
      RETURN v_boro;
    END IF;
  END IF;

  -- Tier 3: city / neighborhood name.
  v_boro := CASE
    WHEN v_city IN ('BROOKLYN','BKLYN','BROOKLYN NY') THEN 'Brooklyn'
    WHEN v_city IN ('BRONX','THE BRONX') THEN 'Bronx'
    WHEN v_city IN ('MANHATTAN','NEW YORK','NEW YORK CITY','NY','NYC','NEW YORK, NY') THEN 'Manhattan'
    WHEN v_city IN ('STATEN ISLAND','STATEN IS') THEN 'Staten Island'
    WHEN v_city IN ('QUEENS','JAMAICA','RIDGEWOOD','FAR ROCKAWAY','FLUSHING','SOUTH RICHMOND HILL',
                    'RICHMOND HILL','FOREST HILLS','MIDDLE VILLAGE','GLENDALE','LONG ISLAND CITY',
                    'HOLLIS','ASTORIA','QUEENS VILLAGE','CORONA','SPRINGFIELD GARDENS','BAYSIDE',
                    'ST. ALBANS','ST ALBANS','ROSEDALE','ROCKAWAY PARK','ELMHURST','WOODHAVEN',
                    'OZONE PARK','SOUTH OZONE PARK','JACKSON HEIGHTS','REGO PARK','WOODSIDE',
                    'MASPETH','WHITESTONE','COLLEGE POINT','FRESH MEADOWS','KEW GARDENS','SUNNYSIDE',
                    'EAST ELMHURST','ARVERNE','BELLEROSE','CAMBRIA HEIGHTS','LAURELTON','HOWARD BEACH')
      THEN 'Queens'
    WHEN v_city IN ('NEWARK','JERSEY CITY','ELIZABETH','PATERSON','UNION CITY') THEN 'New Jersey'
    WHEN v_city IN ('FLORAL PARK','VALLEY STREAM','HEMPSTEAD','FREEPORT','LONG ISLAND','GARDEN CITY',
                    'ELMONT','LYNBROOK','ROCKVILLE CENTRE','MINEOLA','BALDWIN','WESTBURY')
      THEN 'Long Island'
    ELSE NULL
  END;
  IF v_boro IS NOT NULL THEN
    RETURN v_boro;
  END IF;

  -- Tier 4: borough named inside free-text address.
  v_boro := CASE
    WHEN v_addr ~ '\yBROOKLYN\y' THEN 'Brooklyn'
    WHEN v_addr ~ '\yBRONX\y' THEN 'Bronx'
    WHEN v_addr ~ '\ySTATEN ISLAND\y' THEN 'Staten Island'
    WHEN v_addr ~ '\y(QUEENS|JAMAICA|ASTORIA|FLUSHING|RIDGEWOOD|FAR ROCKAWAY|OZONE PARK|ELMHURST)\y' THEN 'Queens'
    WHEN v_addr ~ '\yMANHATTAN\y' THEN 'Manhattan'
    ELSE NULL
  END;

  RETURN v_boro;
END;
$$;

CREATE OR REPLACE FUNCTION public.derive_borough_id(
  _city text,
  _zip text,
  _address text
)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT b.id
  FROM public.boroughs b
  WHERE b.name = public.derive_borough_name(_city, _zip, _address)
  LIMIT 1;
$$;

-- Keep borough_id current for new and edited stores.
CREATE OR REPLACE FUNCTION public.trg_stamp_store_borough()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only auto-fill when blank, or when the address inputs actually changed.
  IF NEW.borough_id IS NULL
     OR TG_OP = 'INSERT'
     OR NEW.city IS DISTINCT FROM OLD.city
     OR NEW.zip IS DISTINCT FROM OLD.zip
     OR NEW.address IS DISTINCT FROM OLD.address
  THEN
    IF NEW.borough_id IS NULL
       OR (TG_OP = 'UPDATE' AND NEW.borough_id IS NOT DISTINCT FROM OLD.borough_id)
    THEN
      NEW.borough_id := COALESCE(
        public.derive_borough_id(NEW.city, NEW.zip, NEW.address),
        NEW.borough_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_store_borough ON public.store_master;
CREATE TRIGGER stamp_store_borough
BEFORE INSERT OR UPDATE OF city, zip, address, borough_id ON public.store_master
FOR EACH ROW EXECUTE FUNCTION public.trg_stamp_store_borough();

CREATE INDEX IF NOT EXISTS idx_store_master_borough_id
  ON public.store_master (borough_id)
  WHERE borough_id IS NOT NULL;
