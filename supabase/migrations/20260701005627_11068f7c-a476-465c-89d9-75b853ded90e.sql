
UPDATE public.crm_partners p
SET compliance_hold = true,
    compliance_hold_reason = 'COMPLIANCE_INCIDENT_2026-07-01: unauthorized 228-lead TopTier dispatch bursts (kill_switch e6e3649c-ec9a-4261-9f69-e1de2cf94a4a). Held pending manual review.',
    compliance_hold_at = now()
FROM (
  SELECT DISTINCT lead_id AS partner_id
  FROM public.dc_lead_sync_log
  WHERE created_at::date = CURRENT_DATE
    AND sync_source = 'tt-trigger-bland-campaign'
    AND business_unit_key = 'top_tier'
) t
WHERE p.id = t.partner_id AND p.compliance_hold = false;
