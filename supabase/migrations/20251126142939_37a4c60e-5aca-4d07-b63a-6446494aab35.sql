-- Create automation rules table
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  business_id uuid REFERENCES public.businesses(id),
  brand text,
  event_type text NOT NULL,
  action_type text NOT NULL DEFAULT 'send_sms',
  is_enabled boolean DEFAULT true,
  template_message text NOT NULL,
  conditions jsonb,
  metadata jsonb,
  created_by uuid REFERENCES public.profiles(id)
);

-- Create automation logs table
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  automation_rule_id uuid REFERENCES public.automation_rules(id),
  business_id uuid REFERENCES public.businesses(id),
  brand text,
  event_type text NOT NULL,
  action_type text NOT NULL,
  entity_id uuid,
  entity_type text,
  recipient_phone text,
  recipient_email text,
  message_sent text,
  status text DEFAULT 'success',
  error_message text,
  communication_log_id uuid REFERENCES public.communication_logs(id)
);

-- Enable RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Policies for automation_rules
CREATE POLICY "Users can view automation rules for their business"
ON public.automation_rules FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create automation rules for their business"
ON public.automation_rules FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update automation rules for their business"
ON public.automation_rules FOR UPDATE
USING (
  business_id IN (
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete automation rules for their business"
ON public.automation_rules FOR DELETE
USING (
  business_id IN (
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

-- Policies for automation_logs
CREATE POLICY "Users can view automation logs for their business"
ON public.automation_logs FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_automation_rules_event_type ON public.automation_rules(event_type);
CREATE INDEX idx_automation_rules_brand ON public.automation_rules(brand);
CREATE INDEX idx_automation_rules_enabled ON public.automation_rules(is_enabled);
CREATE INDEX idx_automation_logs_created_at ON public.automation_logs(created_at DESC);
CREATE INDEX idx_automation_logs_event_type ON public.automation_logs(event_type);

-- Enable realtime for automation_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_logs;

-- Create function to process event-based automations
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
      -- Get contact from order if available
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

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_automation_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_automation_rules_timestamp
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_automation_rules_timestamp();