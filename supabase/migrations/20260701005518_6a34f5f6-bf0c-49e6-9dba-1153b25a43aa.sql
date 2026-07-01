
ALTER TABLE public.crm_partners ADD COLUMN IF NOT EXISTS compliance_hold boolean NOT NULL DEFAULT false;
ALTER TABLE public.crm_partners ADD COLUMN IF NOT EXISTS compliance_hold_reason text;
ALTER TABLE public.crm_partners ADD COLUMN IF NOT EXISTS compliance_hold_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_crm_partners_compliance_hold ON public.crm_partners (compliance_hold) WHERE compliance_hold = true;

-- Flag every crm_partner whose phone appears in any dc_lead touched by today's
-- unauthorized TopTier tt-trigger-bland-campaign dispatches (the four 228-lead
-- campaigns at 00:14:14, 00:14:37, 00:15:05, 00:16:41 UTC 2026-07-01).
WITH touched_phones AS (
  SELECT DISTINCT l.phone
  FROM public.dc_lead_sync_log s
  JOIN public.dc_leads l ON l.id = s.lead_id
  WHERE s.created_at::date = CURRENT_DATE
    AND s.sync_source = 'tt-trigger-bland-campaign'
    AND s.business_unit_key = 'top_tier'
)
UPDATE public.crm_partners p
SET compliance_hold = true,
    compliance_hold_reason = 'COMPLIANCE_INCIDENT_2026-07-01: unauthorized 228-lead TopTier dispatch bursts (kill_switch e6e3649c). Held pending manual review.',
    compliance_hold_at = now()
FROM touched_phones t
WHERE p.phone = t.phone
  AND p.business_slug = 'toptier-experience'
  AND p.compliance_hold = false;
