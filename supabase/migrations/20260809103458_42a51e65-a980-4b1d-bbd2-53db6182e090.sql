CREATE OR REPLACE FUNCTION public.recompute_all_funding_dfs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client record;
  _count integer := 0;
BEGIN
  IF NOT public.is_funding_staff() THEN
    RAISE EXCEPTION 'Not authorized to recompute fundability scores';
  END IF;

  FOR _client IN SELECT id FROM public.funding_clients LOOP
    PERFORM public.compute_funding_dfs(_client.id);
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_all_funding_dfs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_all_funding_dfs() TO authenticated;