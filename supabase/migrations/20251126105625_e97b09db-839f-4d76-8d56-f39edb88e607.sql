-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE template_type AS ENUM ('sms', 'email', 'call_script', 'tone_pack');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE template_category AS ENUM (
    'reorder_reminder',
    'thank_you',
    'delivery_confirmation',
    'upsell',
    'late_payment',
    'promotion',
    'cold_outreach',
    'wholesale_invitation',
    'ambassador_recruitment',
    'multi_brand_announcement',
    'welcome_sequence',
    'invoice',
    'receipt',
    'onboarding',
    'follow_up',
    'account_update',
    'contract_renewal',
    'abandoned_cart',
    'grant_request',
    'store_reorder_call',
    'wholesale_warm_call',
    'new_store_onboarding',
    'collection_reminder',
    'funding_intake',
    'credit_repair_update',
    'chauffeur_confirmation',
    'model_verification'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add missing columns to communication_templates table
ALTER TABLE public.communication_templates 
ADD COLUMN IF NOT EXISTS brand brand_type,
ADD COLUMN IF NOT EXISTS template_type template_type DEFAULT 'sms',
ADD COLUMN IF NOT EXISTS subject TEXT,
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tone_config JSONB;

-- Update content from message_template for existing rows
UPDATE public.communication_templates 
SET content = message_template 
WHERE content IS NULL;

-- Make content NOT NULL after migration (only if there are no NULL values)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE content IS NULL) THEN
    ALTER TABLE public.communication_templates ALTER COLUMN content SET NOT NULL;
  END IF;
END $$;

-- Update category column to use the enum if it exists as text
ALTER TABLE public.communication_templates 
ALTER COLUMN category TYPE template_category USING category::template_category;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_templates_brand_type ON public.communication_templates(brand, template_type);

-- Update RLS policies to work with brand field
DROP POLICY IF EXISTS "Users can view templates for their allowed brands" ON public.communication_templates;
CREATE POLICY "Users can view templates for their allowed brands"
ON public.communication_templates
FOR SELECT
TO authenticated
USING (
  brand IS NULL OR public.can_access_brand(auth.uid(), brand::text)
);