GRANT SELECT ON public.v_batch_yield TO authenticated;
GRANT SELECT ON public.v_yield_watch TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yield_standards TO authenticated;
GRANT ALL ON public.yield_standards TO service_role;