
-- STEP 1: Create intake table
CREATE TABLE IF NOT EXISTS brandaro_leads_intake (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name text,
  phone text,
  category text,
  city text,
  state text,
  area_code text,
  full_address text,
  website text,
  rating numeric,
  reviews_count integer,
  source text DEFAULT 'outscraper',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE brandaro_leads_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON brandaro_leads_intake
  FOR ALL USING (true) WITH CHECK (true);

-- STEP 2: Auto-sync trigger function
CREATE OR REPLACE FUNCTION sync_intake_to_qualified()
RETURNS trigger AS $$
DECLARE
  v_score numeric;
  v_tier text;
  v_has_website boolean;
BEGIN
  v_has_website := (NEW.website IS NOT NULL AND NEW.website != '');
  
  v_score := 5;
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN 
    v_score := v_score + 2; 
  END IF;
  IF NOT v_has_website THEN 
    v_score := v_score + 3;
  ELSE 
    v_score := v_score - 2; 
  END IF;
  IF NEW.rating >= 4.5 THEN v_score := v_score + 2;
  ELSIF NEW.rating >= 4.0 THEN v_score := v_score + 1;
  END IF;
  IF NEW.category ILIKE ANY(ARRAY[
    '%cleaning%','%plumb%','%handyman%','%landscap%',
    '%pressure%','%moving%','%pest%','%appliance%',
    '%painting%','%junk%','%detailing%','%repair%'
  ]) THEN v_score := v_score + 2; END IF;
  v_score := LEAST(10, GREATEST(0, v_score));
  
  IF v_score >= 8 THEN v_tier := 'HOT';
  ELSIF v_score >= 5 THEN v_tier := 'WARM';
  ELSE v_tier := 'COLD';
  END IF;

  INSERT INTO brandaro_qualified_leads (
    business_name, phone_number, industry, category,
    city, state, address, has_website, rating, review_count,
    query_source, pipeline_stage, lead_status,
    priority_score, priority_tier, converted, ai_paused,
    created_at, updated_at
  ) VALUES (
    NEW.business_name, NEW.phone, NEW.category, NEW.category,
    NEW.city, NEW.state, NEW.full_address, v_has_website,
    NEW.rating, NEW.reviews_count, 'outscraper', 'new', 'new',
    v_score, v_tier, false, false, now(), now()
  )
  ON CONFLICT (phone_number) WHERE phone_number IS NOT NULL DO UPDATE SET
    rating = EXCLUDED.rating,
    review_count = EXCLUDED.review_count,
    has_website = EXCLUDED.has_website,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_intake_insert ON brandaro_leads_intake;
CREATE TRIGGER on_intake_insert
  AFTER INSERT ON brandaro_leads_intake
  FOR EACH ROW EXECUTE FUNCTION sync_intake_to_qualified();

-- STEP 3: Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'brandaro_qualified_leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE brandaro_qualified_leads;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'brandaro_leads_intake'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE brandaro_leads_intake;
  END IF;
END $$;
