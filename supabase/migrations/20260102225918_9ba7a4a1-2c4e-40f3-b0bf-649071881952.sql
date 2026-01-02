-- =============================================
-- PHASE 1: Change Control Foundation
-- Dynasty OS Driver & Biker Portal Upgrade
-- =============================================

-- 1. STORE VISITS TABLE (Enhanced)
CREATE TABLE IF NOT EXISTS public.store_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  visited_by UUID NOT NULL REFERENCES auth.users(id),
  visit_type TEXT NOT NULL CHECK (visit_type IN ('delivery', 'check', 'collection', 'follow_up', 'initial')),
  role_type TEXT NOT NULL CHECK (role_type IN ('driver', 'biker', 'va', 'admin')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  notes TEXT,
  payment_collected BOOLEAN DEFAULT false,
  amount_collected NUMERIC(10,2) DEFAULT 0,
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. STORE BRAND STICKERS TABLE
CREATE TABLE IF NOT EXISTS public.store_brand_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id),
  brand_name TEXT NOT NULL, -- Denormalized for quick access
  front_door_sticker BOOLEAN DEFAULT false,
  authorized_retailer_sticker BOOLEAN DEFAULT false,
  brand_character_sticker BOOLEAN DEFAULT false,
  telephone_number_sticker BOOLEAN DEFAULT false,
  notes TEXT,
  last_verified_by UUID REFERENCES auth.users(id),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, brand_name)
);

-- 3. CHANGE LISTS TABLE (Proposed Changes Container)
CREATE TABLE IF NOT EXISTS public.change_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.store_visits(id),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_by_role TEXT NOT NULL CHECK (submitted_by_role IN ('driver', 'biker', 'va', 'admin')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'ai_scanned', 'va_reviewed', 'approved', 'rejected', 'committed', 'archived')),
  ai_risk_level TEXT CHECK (ai_risk_level IN ('low', 'medium', 'high', 'critical')),
  ai_risk_flags JSONB DEFAULT '[]'::jsonb,
  ai_scanned_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  committed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CHANGE LIST ITEMS TABLE (Individual Field Changes)
CREATE TABLE IF NOT EXISTS public.change_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_list_id UUID NOT NULL REFERENCES public.change_lists(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('store', 'inventory', 'sticker', 'contact', 'billing', 'questionnaire', 'notes')),
  entity_id UUID, -- Reference to the specific record being changed
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  requires_note BOOLEAN DEFAULT false,
  change_note TEXT,
  ai_flagged BOOLEAN DEFAULT false,
  ai_flag_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. STORE QUESTIONNAIRE TABLE
CREATE TABLE IF NOT EXISTS public.store_questionnaire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE UNIQUE,
  total_store_count INTEGER,
  security_level TEXT CHECK (security_level IN ('low', 'medium', 'high')),
  sells_flowers BOOLEAN,
  wholesalers_used TEXT[], -- Array of wholesaler names
  clothing_size TEXT,
  interested_cleaning_service BOOLEAN,
  last_verified_by UUID REFERENCES auth.users(id),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. CHANGE CONTROL AUDIT LOG (Immutable)
CREATE TABLE IF NOT EXISTS public.change_control_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_list_id UUID REFERENCES public.change_lists(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'submitted', 'ai_scanned', 'reviewed', 'approved', 'rejected', 'committed', 'archived')),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_role TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. STORE CONTACT RESPONSIVENESS (Extend existing store_contacts)
ALTER TABLE public.store_contacts 
  ADD COLUMN IF NOT EXISTS responsive_by_call BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS responsive_by_text BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_brand_stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_questionnaire ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_control_audit ENABLE ROW LEVEL SECURITY;

-- STORE VISITS: Drivers/Bikers can create their own, elevated can see all
CREATE POLICY "Users can create their own visits" ON public.store_visits
  FOR INSERT TO authenticated
  WITH CHECK (visited_by = auth.uid());

CREATE POLICY "Users can view their own visits" ON public.store_visits
  FOR SELECT TO authenticated
  USING (visited_by = auth.uid() OR public.is_elevated_user(auth.uid()));

CREATE POLICY "Users can update their own in-progress visits" ON public.store_visits
  FOR UPDATE TO authenticated
  USING (visited_by = auth.uid() AND status = 'in_progress');

CREATE POLICY "Elevated users can manage all visits" ON public.store_visits
  FOR ALL TO authenticated
  USING (public.is_elevated_user(auth.uid()))
  WITH CHECK (public.is_elevated_user(auth.uid()));

-- STORE BRAND STICKERS: Read-only for drivers/bikers, elevated can modify
CREATE POLICY "Authenticated users can view stickers" ON public.store_brand_stickers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated users can manage stickers" ON public.store_brand_stickers
  FOR ALL TO authenticated
  USING (public.is_elevated_user(auth.uid()))
  WITH CHECK (public.is_elevated_user(auth.uid()));

-- CHANGE LISTS: Users create/submit, elevated review/approve
CREATE POLICY "Users can create their own change lists" ON public.change_lists
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Users can view their own change lists" ON public.change_lists
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.is_elevated_user(auth.uid()));

CREATE POLICY "Users can update their own draft change lists" ON public.change_lists
  FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND status = 'draft');

CREATE POLICY "Elevated users can manage all change lists" ON public.change_lists
  FOR ALL TO authenticated
  USING (public.is_elevated_user(auth.uid()))
  WITH CHECK (public.is_elevated_user(auth.uid()));

-- CHANGE LIST ITEMS: Follow parent change_list permissions
CREATE POLICY "Users can create items for their change lists" ON public.change_list_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.change_lists cl 
      WHERE cl.id = change_list_id 
      AND (cl.submitted_by = auth.uid() OR public.is_elevated_user(auth.uid()))
    )
  );

CREATE POLICY "Users can view items from their change lists" ON public.change_list_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.change_lists cl 
      WHERE cl.id = change_list_id 
      AND (cl.submitted_by = auth.uid() OR public.is_elevated_user(auth.uid()))
    )
  );

CREATE POLICY "Elevated users can manage all change list items" ON public.change_list_items
  FOR ALL TO authenticated
  USING (public.is_elevated_user(auth.uid()))
  WITH CHECK (public.is_elevated_user(auth.uid()));

-- STORE QUESTIONNAIRE: Read-only for drivers/bikers, elevated can modify
CREATE POLICY "Authenticated users can view questionnaires" ON public.store_questionnaire
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated users can manage questionnaires" ON public.store_questionnaire
  FOR ALL TO authenticated
  USING (public.is_elevated_user(auth.uid()))
  WITH CHECK (public.is_elevated_user(auth.uid()));

-- CHANGE CONTROL AUDIT: Read-only for everyone, only system can insert
CREATE POLICY "Elevated users can view audit log" ON public.change_control_audit
  FOR SELECT TO authenticated
  USING (public.is_elevated_user(auth.uid()));

CREATE POLICY "Elevated users can insert audit entries" ON public.change_control_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.is_elevated_user(auth.uid()));

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_store_visits_store_id ON public.store_visits(store_id);
CREATE INDEX IF NOT EXISTS idx_store_visits_visited_by ON public.store_visits(visited_by);
CREATE INDEX IF NOT EXISTS idx_store_visits_status ON public.store_visits(status);
CREATE INDEX IF NOT EXISTS idx_store_visits_created_at ON public.store_visits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_brand_stickers_store_id ON public.store_brand_stickers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_brand_stickers_brand ON public.store_brand_stickers(brand_name);

CREATE INDEX IF NOT EXISTS idx_change_lists_store_id ON public.change_lists(store_id);
CREATE INDEX IF NOT EXISTS idx_change_lists_submitted_by ON public.change_lists(submitted_by);
CREATE INDEX IF NOT EXISTS idx_change_lists_status ON public.change_lists(status);
CREATE INDEX IF NOT EXISTS idx_change_lists_created_at ON public.change_lists(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_list_items_change_list_id ON public.change_list_items(change_list_id);
CREATE INDEX IF NOT EXISTS idx_change_list_items_entity_type ON public.change_list_items(entity_type);

CREATE INDEX IF NOT EXISTS idx_store_questionnaire_store_id ON public.store_questionnaire(store_id);

CREATE INDEX IF NOT EXISTS idx_change_control_audit_change_list_id ON public.change_control_audit(change_list_id);
CREATE INDEX IF NOT EXISTS idx_change_control_audit_created_at ON public.change_control_audit(created_at DESC);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_store_visits_updated_at
  BEFORE UPDATE ON public.store_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_brand_stickers_updated_at
  BEFORE UPDATE ON public.store_brand_stickers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_change_lists_updated_at
  BEFORE UPDATE ON public.change_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_questionnaire_updated_at
  BEFORE UPDATE ON public.store_questionnaire
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ENABLE REALTIME FOR KEY TABLES
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.change_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_visits;