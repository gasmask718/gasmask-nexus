CREATE UNIQUE INDEX IF NOT EXISTS brandaro_subscriptions_active_project_uidx
  ON public.brandaro_subscriptions (project_id)
  WHERE status IN ('active','trialing','past_due','incomplete');

GRANT SELECT ON public.brandaro_subscriptions TO authenticated;
GRANT ALL ON public.brandaro_subscriptions TO service_role;