
-- Create store_tube_switches table
CREATE TABLE public.store_tube_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  old_tube_batch_id uuid,
  old_tube_type text,
  estimated_old_tube_quantity integer NOT NULL DEFAULT 0,
  switch_reason text NOT NULL CHECK (switch_reason IN ('damaged', 'outdated_branding', 'product_upgrade', 'compliance', 'performance_issue', 'other')),
  switched_quantity integer NOT NULL DEFAULT 0,
  switched_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  territory text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for store lookups
CREATE INDEX idx_store_tube_switches_store_id ON public.store_tube_switches(store_id);
CREATE INDEX idx_store_tube_switches_created_at ON public.store_tube_switches(created_at DESC);

-- Enable RLS
ALTER TABLE public.store_tube_switches ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users with relevant roles
CREATE POLICY "Authorized roles can view tube switches"
  ON public.store_tube_switches
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'va') OR
    public.has_role(auth.uid(), 'ambassador') OR
    public.has_role(auth.uid(), 'driver') OR
    public.has_role(auth.uid(), 'biker')
  );

-- INSERT: restricted to admin, va, ambassador, biker
CREATE POLICY "Authorized roles can insert tube switches"
  ON public.store_tube_switches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    switched_by_user_id = auth.uid() AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'va') OR
      public.has_role(auth.uid(), 'ambassador') OR
      public.has_role(auth.uid(), 'biker')
    )
  );
