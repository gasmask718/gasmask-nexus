ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS notification_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_notification_type text;