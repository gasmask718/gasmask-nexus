-- Add missing boroughs (Long Island, New Jersey)
INSERT INTO public.boroughs (name) VALUES 
  ('Long Island'),
  ('New Jersey')
ON CONFLICT DO NOTHING;

-- Add missing customer roles
INSERT INTO public.customer_roles (role_name) VALUES
  ('Co-Owner'),
  ('Assistant Manager'),
  ('Distributor'),
  ('Bookkeeper'),
  ('Store Clerk'),
  ('Delivery Contact'),
  ('Owner''s Son'),
  ('Owner''s Brother'),
  ('Owner''s Uncle'),
  ('Ambassador'),
  ('Secondary Contact'),
  ('Emergency Contact')
ON CONFLICT DO NOTHING;

-- Update brands table with correct colors and add missing brands
UPDATE public.brands SET color = '#E7A1B0' WHERE name = 'Hot Mama';
UPDATE public.brands SET color = '#8A2BE2' WHERE name = 'Grabba R Us';
UPDATE public.brands SET color = '#FF7F11' WHERE name = 'HotScalati';

-- Add missing brands
INSERT INTO public.brands (name, color) VALUES
  ('Top Tier Experience', '#000000'),
  ('Unforgettable Times USA', '#4169E1'),
  ('iClean WeClean', '#00CED1'),
  ('The Playboxxx', '#FF1493'),
  ('Prime Source Depot', '#228B22'),
  ('Funding Company', '#FFD700'),
  ('OS Dynasty', '#1E1E2F')
ON CONFLICT DO NOTHING;

-- Add active column to brands if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'active'
  ) THEN
    ALTER TABLE public.brands ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;
END $$;