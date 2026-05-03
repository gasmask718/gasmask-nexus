GRANT EXECUTE ON FUNCTION public.analyze_store_duplicate_groups() TO supabase_read_only_user, service_role, anon;
GRANT EXECUTE ON FUNCTION public.analyze_store_duplicate_groups_summary() TO supabase_read_only_user, service_role, anon;
GRANT EXECUTE ON FUNCTION public.detect_data_duplicates_in_group(integer) TO supabase_read_only_user, service_role, anon;