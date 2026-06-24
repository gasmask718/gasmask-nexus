-- Add 'pending' role for new public sign-ups (no privileges until admin promotes them)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pending';

-- Update signup trigger to default new accounts to 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'pending')
  );
  RETURN NEW;
END;
$function$;