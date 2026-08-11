REVOKE ALL ON public.grant_eligibility_results FROM anon;
REVOKE ALL ON public.funding_strategy_rules FROM anon;
GRANT SELECT ON public.grant_eligibility_results TO authenticated;
GRANT ALL ON public.grant_eligibility_results TO service_role;
GRANT SELECT ON public.funding_strategy_rules TO authenticated;
GRANT ALL ON public.funding_strategy_rules TO service_role;