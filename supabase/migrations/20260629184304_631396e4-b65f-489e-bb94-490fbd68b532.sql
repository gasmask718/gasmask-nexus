CREATE TABLE IF NOT EXISTS public.dd_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid REFERENCES store_accounts(id) ON DELETE SET NULL,
  name text,
  frequency text NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','quarterly')),
  next_order_date date NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_estimate numeric,
  payment_method text DEFAULT 'card_on_file',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  orders_placed int NOT NULL DEFAULT 0,
  last_order_id uuid,
  last_order_date date,
  failure_reason text,
  shipping_address jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_subscriptions TO authenticated;
GRANT ALL ON public.dd_subscriptions TO service_role;

ALTER TABLE public.dd_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subs"
  ON public.dd_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin full access to subs"
  ON public.dd_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_dd_subs_due
  ON public.dd_subscriptions(next_order_date)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_dd_subs_user ON public.dd_subscriptions(user_id);

CREATE OR REPLACE FUNCTION public.dd_subscriptions_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dd_subs_touch ON public.dd_subscriptions;
CREATE TRIGGER trg_dd_subs_touch
  BEFORE UPDATE ON public.dd_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.dd_subscriptions_touch();