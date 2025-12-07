-- Seed default companies if table is empty (using correct column names)
INSERT INTO public.companies (name, type)
SELECT name, 'store'
FROM (VALUES 
  ('GasMask'),
  ('Grabba R Us'),
  ('Hot Mama Grabba'),
  ('Hot Scalati'),
  ('TopTier Experience'),
  ('Playboxxx'),
  ('Unforgettable Times USA'),
  ('Prime Source Depot'),
  ('iClean WeClean'),
  ('OS Dynasty')
) AS defaults(name)
WHERE NOT EXISTS (SELECT 1 FROM public.companies LIMIT 1);