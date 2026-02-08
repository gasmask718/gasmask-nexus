
-- ═══════════════════════════════════════════════════════════════
-- DELIVERY CHECKLIST SYSTEM — Per-store visit task tracking
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.delivery_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  user_id UUID NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Task completion tracking (JSON map: task_key -> { completed, completed_at, metadata })
  tasks_completed JSONB DEFAULT '{}',
  
  -- Structured data captured during checklist
  inventory_updates JSONB DEFAULT '{}',
  order_confirmations JSONB DEFAULT '{}',
  growth_captures JSONB DEFAULT '{}',
  contact_updates JSONB DEFAULT '{}',
  sticker_status JSONB DEFAULT '{}',
  
  -- Photos
  photo_urls TEXT[] DEFAULT '{}',
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint: one active checklist per store per user per day
  UNIQUE (store_id, user_id, visit_date)
);

-- Enable RLS
ALTER TABLE public.delivery_checklists ENABLE ROW LEVEL SECURITY;

-- Users can manage their own checklists
CREATE POLICY "Users can view their own checklists"
ON public.delivery_checklists FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checklists"
ON public.delivery_checklists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklists"
ON public.delivery_checklists FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all checklists
CREATE POLICY "Admins can view all checklists"
ON public.delivery_checklists FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Index for fast lookups
CREATE INDEX idx_delivery_checklists_store_date ON public.delivery_checklists (store_id, visit_date);
CREATE INDEX idx_delivery_checklists_user_date ON public.delivery_checklists (user_id, visit_date);

-- Trigger for updated_at
CREATE TRIGGER update_delivery_checklists_updated_at
BEFORE UPDATE ON public.delivery_checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
