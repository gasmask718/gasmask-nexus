-- Add missing RLS policies for inventory_movements
CREATE POLICY "Admins can view inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "System can insert inventory movements"
  ON public.inventory_movements FOR INSERT
  WITH CHECK (true);

-- Add missing RLS policies for store_transactions
CREATE POLICY "Stores can view their transactions"
  ON public.store_transactions FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE id = store_id) OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'csr')
  ));

CREATE POLICY "Admins can manage transactions"
  ON public.store_transactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));