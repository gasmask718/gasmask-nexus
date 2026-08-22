CREATE OR REPLACE VIEW public.v_ambassador_referral_tree AS
SELECT
  a.id,
  a.name,
  a.tracking_code,
  a.recruited_by_ambassador_id,
  a.is_active
FROM public.ambassadors a;

GRANT SELECT ON public.v_ambassador_referral_tree TO authenticated;
GRANT ALL ON public.v_ambassador_referral_tree TO service_role;