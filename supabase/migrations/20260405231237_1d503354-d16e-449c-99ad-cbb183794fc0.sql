
-- Line items for corporate event proposals
CREATE TABLE public.corporate_event_proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.corporate_event_proposals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('venue','staff','rental')),
  item_id UUID,
  item_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (quantity * price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_items_proposal ON public.corporate_event_proposal_items(proposal_id);

ALTER TABLE public.corporate_event_proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage proposal items"
  ON public.corporate_event_proposal_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
