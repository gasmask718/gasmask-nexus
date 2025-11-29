-- Add insert policies for role profile tables

-- Ambassador Profiles insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ambassador_profiles' AND policyname = 'Users insert own ambassador profile'
  ) THEN
    CREATE POLICY "Users insert own ambassador profile"
    ON public.ambassador_profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Driver Profiles insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'driver_profiles' AND policyname = 'Users insert own driver profile'
  ) THEN
    CREATE POLICY "Users insert own driver profile"
    ON public.driver_profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Biker Profiles insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'biker_profiles' AND policyname = 'Users insert own biker profile'
  ) THEN
    CREATE POLICY "Users insert own biker profile"
    ON public.biker_profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Store Profiles insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'store_profiles' AND policyname = 'Users insert own store profile'
  ) THEN
    CREATE POLICY "Users insert own store profile"
    ON public.store_profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Wholesaler Profiles insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wholesaler_profiles' AND policyname = 'Users insert own wholesaler profile'
  ) THEN
    CREATE POLICY "Users insert own wholesaler profile"
    ON public.wholesaler_profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Production Profiles insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'production_profiles' AND policyname = 'Users insert own production profile'
  ) THEN
    CREATE POLICY "Users insert own production profile"
    ON public.production_profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- VA Profiles insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'va_profiles' AND policyname = 'Users insert own va profile'
  ) THEN
    CREATE POLICY "Users insert own va profile"
    ON public.va_profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;