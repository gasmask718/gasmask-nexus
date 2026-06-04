
DROP TABLE IF EXISTS public.ambassador_commissions CASCADE;
DROP TABLE IF EXISTS public.commission_events CASCADE;

CREATE VIEW public.ambassador_commissions
WITH (security_invoker = true) AS
SELECT
  cl.id,
  cl.ambassador_id,
  CASE WHEN cl.source_channel IN ('wholesale_order','store_order') THEN cl.source_id END AS order_id,
  'order'::text                                                                          AS entity_type,
  cl.source_id                                                                            AS entity_id,
  cl.commission_amount                                                                    AS amount,
  CASE WHEN cl.status = 'reversed' THEN 'canceled' ELSE cl.status END                     AS status,
  cl.paid_at,
  NULL::text                                                                              AS notes,
  COALESCE(cl.created_at, cl.earned_at)                                                   AS created_at
FROM public.commission_ledger cl;

COMMENT ON VIEW public.ambassador_commissions IS
  'DEPRECATED compat view over commission_ledger. Read-only bridge until 26 readers are rewritten. Drops when rewrite lands.';

GRANT SELECT ON public.ambassador_commissions TO authenticated;
GRANT SELECT ON public.ambassador_commissions TO anon;
GRANT ALL    ON public.ambassador_commissions TO service_role;

CREATE VIEW public.commission_events
WITH (security_invoker = true) AS
SELECT
  cl.id,
  cl.ambassador_id,
  CASE cl.source_channel
    WHEN 'store_order'     THEN 'store'
    WHEN 'wholesale_order' THEN 'wholesaler'
    WHEN 'affiliate'       THEN 'influencer'
    ELSE 'ambassador'
  END                                                              AS category,
  cl.source_channel                                                AS source_entity_type,
  cl.source_id                                                     AS source_entity_id,
  cl.source_name                                                   AS source_entity_name,
  cl.source_channel                                                AS trigger_type,
  cl.gross_amount,
  cl.commission_rate,
  cl.commission_amount,
  CASE WHEN cl.status = 'reversed' THEN 'pending' ELSE cl.status END AS status,
  NULL::text                                                       AS reference_id,
  '{}'::jsonb                                                      AS metadata,
  COALESCE(cl.created_at, cl.earned_at)                            AS created_at,
  cl.approved_at,
  NULL::uuid                                                       AS approved_by,
  cl.paid_at,
  NULL::uuid                                                       AS paid_by
FROM public.commission_ledger cl;

COMMENT ON VIEW public.commission_events IS
  'DEPRECATED compat view over commission_ledger. Read-only bridge until 26 readers are rewritten. Drops when rewrite lands.';

GRANT SELECT ON public.commission_events TO authenticated;
GRANT SELECT ON public.commission_events TO anon;
GRANT ALL    ON public.commission_events TO service_role;
