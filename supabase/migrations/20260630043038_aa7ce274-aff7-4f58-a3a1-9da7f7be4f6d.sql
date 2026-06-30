COMMENT ON COLUMN public.brandaro_qualified_leads.lead_status IS
'Audited 2026-06-30 against dc_disposition_codes: 100% canonical (all 529 rows = ''new''). No data migration required. Forward call-disposition writes will land on a future disposition_code column; this column remains the pre-call lead intake status.';

COMMENT ON COLUMN public.brandaro_leads_master.status IS
'Audited 2026-06-30 against dc_disposition_codes: 100% canonical (all 225 rows = ''new''). No data migration required. Forward call-disposition writes will land on a future disposition_code column; this column remains the pre-call lead intake status.';

COMMENT ON COLUMN public.brandaro_qualified_leads.pipeline_stage IS
'Brandaro sales-funnel lifecycle field (e.g. new, contacted). Distinct from call disposition — set by sales progression, not by raw call outcome. Deliberately NOT coerced into dc_disposition_codes; same separation pattern as re_lifecycle_stages. Per-call outcomes will write to a separate disposition_code column when Step 4 handler rewiring lands.';