-- Fix: Function Search Path Mutable security issue
-- Add SET search_path = public to all functions missing it

-- Fix update_contact_last_communication
CREATE OR REPLACE FUNCTION public.update_contact_last_communication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE public.crm_contacts
    SET last_contact_date = NEW.created_at,
        updated_at = now()
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix update_relationship_status
CREATE OR REPLACE FUNCTION public.update_relationship_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.crm_contacts
  SET relationship_status = 'cold',
      updated_at = now()
  WHERE relationship_status = 'active'
    AND last_contact_date < (now() - interval '30 days');
  
  UPDATE public.crm_contacts
  SET relationship_status = 'lost',
      updated_at = now()
  WHERE relationship_status IN ('active', 'warm', 'cold')
    AND last_contact_date < (now() - interval '60 days');
    
  UPDATE public.crm_contacts
  SET relationship_status = 'active',
      updated_at = now()
  WHERE relationship_status != 'active'
    AND last_contact_date > (now() - interval '7 days');
END;
$function$;

-- Fix update_crm_customer_timestamp
CREATE OR REPLACE FUNCTION public.update_crm_customer_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_customer_balance
CREATE OR REPLACE FUNCTION public.update_customer_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Update or insert customer balance
  INSERT INTO public.customer_balance (customer_id, last_invoice_date, outstanding_balance)
  VALUES (
    NEW.customer_id,
    NEW.invoice_date,
    NEW.total_amount
  )
  ON CONFLICT (customer_id)
  DO UPDATE SET
    last_invoice_date = EXCLUDED.last_invoice_date,
    outstanding_balance = customer_balance.outstanding_balance + EXCLUDED.outstanding_balance,
    updated_at = now();
  
  RETURN NEW;
END;
$function$;

-- Fix update_balance_on_payment
CREATE OR REPLACE FUNCTION public.update_balance_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.customer_balance
  SET 
    outstanding_balance = outstanding_balance - NEW.amount_paid,
    last_payment_date = NEW.receipt_date,
    updated_at = now()
  WHERE customer_id = NEW.customer_id;
  
  RETURN NEW;
END;
$function$;

-- Fix update_updated_at_column (this one was missing SET search_path)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Fix handle_new_user
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
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'driver')
  );
  RETURN NEW;
END;
$function$;

-- Fix update_drivers_location_timestamp
CREATE OR REPLACE FUNCTION public.update_drivers_location_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_reminder_status
CREATE OR REPLACE FUNCTION public.update_reminder_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'pending' AND NEW.follow_up_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  END IF;
  RETURN NEW;
END;
$function$;