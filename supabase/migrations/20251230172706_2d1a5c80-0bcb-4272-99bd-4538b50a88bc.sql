-- Fix search_path for security
ALTER FUNCTION public.auto_settle_to_final_results() SET search_path = public;
ALTER FUNCTION public.backfill_final_results() SET search_path = public;