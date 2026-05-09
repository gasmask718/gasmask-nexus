CREATE TABLE public.campaign_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  flow_status text,
  intent text NOT NULL DEFAULT 'reactivation',
  queued_at timestamptz NOT NULL DEFAULT now(),
  queued_by uuid REFERENCES auth.users(id),
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  campaign_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cqi_store_id ON public.campaign_queue_items(store_id);
CREATE INDEX idx_cqi_unprocessed ON public.campaign_queue_items(processed, queued_at) WHERE processed = false;
CREATE INDEX idx_cqi_flow_status ON public.campaign_queue_items(flow_status, queued_at DESC);

ALTER TABLE public.campaign_queue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert campaign queue items"
  ON public.campaign_queue_items FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can read campaign queue items"
  ON public.campaign_queue_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can update campaign queue items"
  ON public.campaign_queue_items FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('admin','owner','founder')
    )
  );

CREATE POLICY "Admins can delete campaign queue items"
  ON public.campaign_queue_items FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('admin','owner','founder')
    )
  );