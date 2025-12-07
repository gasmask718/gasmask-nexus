-- Create personal notes table for CRM records
CREATE TABLE IF NOT EXISTS public.crm_personal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(entity_type, entity_id)
);

-- Create notes history table for edit tracking
CREATE TABLE IF NOT EXISTS public.crm_personal_notes_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content TEXT,
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  edited_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.crm_personal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_personal_notes_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage notes
CREATE POLICY "Users can view all notes" ON public.crm_personal_notes
  FOR SELECT USING (true);

CREATE POLICY "Users can insert notes" ON public.crm_personal_notes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update notes" ON public.crm_personal_notes
  FOR UPDATE USING (true);

CREATE POLICY "Users can view notes history" ON public.crm_personal_notes_history
  FOR SELECT USING (true);

CREATE POLICY "Users can insert notes history" ON public.crm_personal_notes_history
  FOR INSERT WITH CHECK (true);

-- Add address fields to brand_crm_contacts if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_crm_contacts' AND column_name = 'address_street') THEN
    ALTER TABLE public.brand_crm_contacts ADD COLUMN address_street TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_crm_contacts' AND column_name = 'address_city') THEN
    ALTER TABLE public.brand_crm_contacts ADD COLUMN address_city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_crm_contacts' AND column_name = 'address_state') THEN
    ALTER TABLE public.brand_crm_contacts ADD COLUMN address_state TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_crm_contacts' AND column_name = 'address_zip') THEN
    ALTER TABLE public.brand_crm_contacts ADD COLUMN address_zip TEXT;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_crm_personal_notes_entity ON public.crm_personal_notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_personal_notes_history_entity ON public.crm_personal_notes_history(entity_type, entity_id);