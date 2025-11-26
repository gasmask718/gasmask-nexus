-- Fix security warnings: Set search_path for functions

-- Drop trigger first, then function
DROP TRIGGER IF EXISTS update_automation_rules_timestamp ON public.automation_rules;
DROP FUNCTION IF EXISTS public.update_automation_rules_timestamp();

-- Recreate function with proper search_path
CREATE OR REPLACE FUNCTION public.update_automation_rules_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER update_automation_rules_timestamp
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_automation_rules_timestamp();

-- Drop and recreate process_automation_event with proper search_path
DROP FUNCTION IF EXISTS public.process_automation_event(text, uuid, text, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.process_automation_event(
  p_event_type text,
  p_entity_id uuid,
  p_entity_type text,
  p_brand text DEFAULT NULL,
  p_business_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_phone text;
  v_email text;
  v_message text;
  v_contact_id uuid;
BEGIN
  -- Find active automation rules for this event
  FOR v_rule IN 
    SELECT * FROM public.automation_rules 
    WHERE event_type = p_event_type 
    AND is_enabled = true
    AND (brand = p_brand OR brand IS NULL)
    AND (business_id = p_business_id OR business_id IS NULL)
  LOOP
    -- Extract recipient contact info based on entity type
    IF p_entity_type = 'store' THEN
      SELECT phone INTO v_phone FROM public.stores WHERE id = p_entity_id;
    ELSIF p_entity_type = 'contact' THEN
      SELECT phone, email, id INTO v_phone, v_email, v_contact_id 
      FROM public.crm_contacts WHERE id = p_entity_id;
    ELSIF p_entity_type = 'order' THEN
      SELECT c.phone, c.email, c.id INTO v_phone, v_email, v_contact_id
      FROM public.crm_contacts c
      WHERE c.id = (SELECT contact_id FROM public.orders WHERE id = p_entity_id LIMIT 1);
    END IF;

    -- Replace template variables in message
    v_message := v_rule.template_message;
    v_message := replace(v_message, '{brand}', COALESCE(p_brand, 'Dynasty'));
    v_message := replace(v_message, '{store_name}', COALESCE((SELECT name FROM public.stores WHERE id = p_entity_id), ''));
    
    -- Log the automation (will be processed by edge function)
    INSERT INTO public.automation_logs (
      automation_rule_id,
      business_id,
      brand,
      event_type,
      action_type,
      entity_id,
      entity_type,
      recipient_phone,
      recipient_email,
      message_sent,
      status
    ) VALUES (
      v_rule.id,
      p_business_id,
      p_brand,
      p_event_type,
      v_rule.action_type,
      p_entity_id,
      p_entity_type,
      v_phone,
      v_email,
      v_message,
      'pending'
    );
  END LOOP;
END;
$$;