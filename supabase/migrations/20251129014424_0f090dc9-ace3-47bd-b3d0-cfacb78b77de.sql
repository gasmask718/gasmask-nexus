-- ═══════════════════════════════════════════════════════════════════════════════
-- GRABBA AUTOPILOT TABLES
-- Phase 6: Task queue and playbooks for the autopilot layer
-- ═══════════════════════════════════════════════════════════════════════════════

-- Autopilot Tasks Queue
CREATE TABLE public.grabba_autopilot_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  floor INTEGER NOT NULL DEFAULT 0,
  brand TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  entity_id TEXT,
  entity_type TEXT,
  suggested_due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Playbooks Library
CREATE TABLE public.grabba_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  floor INTEGER NOT NULL DEFAULT 0,
  default_type TEXT NOT NULL,
  default_priority TEXT NOT NULL DEFAULT 'medium',
  checklist JSONB DEFAULT '[]'::jsonb,
  brand TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grabba_autopilot_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grabba_playbooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for autopilot_tasks (allow all authenticated users)
CREATE POLICY "Allow authenticated users to read autopilot tasks"
  ON public.grabba_autopilot_tasks FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert autopilot tasks"
  ON public.grabba_autopilot_tasks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update autopilot tasks"
  ON public.grabba_autopilot_tasks FOR UPDATE
  USING (true);

-- RLS Policies for playbooks (allow all authenticated users)
CREATE POLICY "Allow authenticated users to read playbooks"
  ON public.grabba_playbooks FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage playbooks"
  ON public.grabba_playbooks FOR ALL
  USING (true);

-- Indexes for performance
CREATE INDEX idx_autopilot_tasks_status ON public.grabba_autopilot_tasks(status);
CREATE INDEX idx_autopilot_tasks_floor ON public.grabba_autopilot_tasks(floor);
CREATE INDEX idx_autopilot_tasks_priority ON public.grabba_autopilot_tasks(priority);
CREATE INDEX idx_autopilot_tasks_created ON public.grabba_autopilot_tasks(created_at DESC);
CREATE INDEX idx_autopilot_tasks_type ON public.grabba_autopilot_tasks(type);

-- Insert default playbooks
INSERT INTO public.grabba_playbooks (slug, name, description, floor, default_type, default_priority, checklist) VALUES
('restock-run', 'Store Restock Run', 'Standard procedure for restocking a store with tubes', 3, 'restock_run', 'high', '[{"step": 1, "action": "Check current inventory levels"}, {"step": 2, "action": "Confirm order quantity needed"}, {"step": 3, "action": "Assign driver for delivery"}, {"step": 4, "action": "Complete delivery and update inventory"}]'),
('collection-call', 'Collection Call', 'Follow up on unpaid accounts', 5, 'collection_call', 'medium', '[{"step": 1, "action": "Review account balance and history"}, {"step": 2, "action": "Call store owner/manager"}, {"step": 3, "action": "Document outcome and next steps"}, {"step": 4, "action": "Schedule follow-up if needed"}]'),
('store-checkin', 'Store Check-in', 'Regular store relationship maintenance', 1, 'store_checkin', 'medium', '[{"step": 1, "action": "Review store activity history"}, {"step": 2, "action": "Call or visit store"}, {"step": 3, "action": "Document feedback and issues"}, {"step": 4, "action": "Update CRM notes"}]'),
('ambassador-review', 'Ambassador Performance Review', 'Review and re-engage ambassador', 8, 'ambassador_checkin', 'medium', '[{"step": 1, "action": "Review ambassador activity metrics"}, {"step": 2, "action": "Contact ambassador"}, {"step": 3, "action": "Discuss performance and goals"}, {"step": 4, "action": "Set action items"}]'),
('driver-review', 'Driver Performance Review', 'Address driver performance issues', 4, 'driver_review', 'high', '[{"step": 1, "action": "Review delivery completion rates"}, {"step": 2, "action": "Check route efficiency"}, {"step": 3, "action": "Meet with driver"}, {"step": 4, "action": "Document action plan"}]'),
('wholesaler-activation', 'Wholesaler Activation', 'Re-engage inactive wholesaler', 7, 'wholesaler_activation', 'medium', '[{"step": 1, "action": "Review wholesaler order history"}, {"step": 2, "action": "Prepare promotional offer"}, {"step": 3, "action": "Contact wholesaler"}, {"step": 4, "action": "Process new order if successful"}]');