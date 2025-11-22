-- Phase 10: Store Performance Snapshots
CREATE TABLE IF NOT EXISTS public.store_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  daily_sales INTEGER DEFAULT 0,
  weekly_sales INTEGER DEFAULT 0,
  monthly_sales INTEGER DEFAULT 0,
  sell_through_rate FLOAT DEFAULT 0,
  restock_frequency INTEGER DEFAULT 0,
  inventory_age_days INTEGER DEFAULT 0,
  driver_visit_count INTEGER DEFAULT 0,
  communication_score INTEGER DEFAULT 0,
  performance_score INTEGER DEFAULT 50,
  risk_score INTEGER DEFAULT 0,
  ai_recommendation TEXT
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_store_performance_store_id ON public.store_performance_snapshots(store_id);
CREATE INDEX IF NOT EXISTS idx_store_performance_created_at ON public.store_performance_snapshots(created_at DESC);

-- Enable RLS
ALTER TABLE public.store_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all performance snapshots"
  ON public.store_performance_snapshots
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "System can insert performance snapshots"
  ON public.store_performance_snapshots
  FOR INSERT
  WITH CHECK (true);

-- Add performance fields to stores table if not exists
ALTER TABLE public.stores 
  ADD COLUMN IF NOT EXISTS performance_tier TEXT DEFAULT 'Standard' CHECK (performance_tier IN ('Platinum', 'Gold', 'Silver', 'Standard', 'At-Risk')),
  ADD COLUMN IF NOT EXISTS performance_score INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS last_performance_update TIMESTAMPTZ;