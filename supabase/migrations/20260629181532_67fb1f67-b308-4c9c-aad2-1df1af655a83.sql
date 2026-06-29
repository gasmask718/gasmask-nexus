
CREATE TABLE IF NOT EXISTS public.dd_abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text UNIQUE,
  email text,
  cart_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  cart_total numeric DEFAULT 0,
  item_count int DEFAULT 0,
  recovery_email_sent_at timestamptz,
  recovery_sms_sent_at timestamptz,
  recovered_at timestamptz,
  recovery_order_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_abandoned_carts TO authenticated;
GRANT ALL ON public.dd_abandoned_carts TO service_role;

ALTER TABLE public.dd_abandoned_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.dd_abandoned_carts;
CREATE POLICY "Admin full access"
  ON public.dd_abandoned_carts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS dd_abandoned_carts_recovery_idx
  ON public.dd_abandoned_carts (recovered_at, recovery_email_sent_at, created_at);
