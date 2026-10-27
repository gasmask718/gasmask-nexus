-- Run through a privileged database query session; every write test rolls back.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"8d25323c-c592-4d5d-bd2d-3849eac68a55","role":"authenticated"}',true);
DO $$
DECLARE n integer; result jsonb;
BEGIN
  SELECT public.ambassador_area_prospects_page('','',1) INTO result;
  IF jsonb_array_length(result->'items')<>25 THEN RAISE EXCEPTION 'Expected 25 rows per page'; END IF;
  IF EXISTS(SELECT 1 FROM public.store_prospects WHERE NOT (lower(borough_or_county) IN ('bronx','mount vernon','yonkers','manhattan','manhattan (rest)') OR lower(neighborhood) IN ('bronx','mount vernon','yonkers','manhattan','manhattan (rest)'))) THEN RAISE EXCEPTION 'Outside Feeno territory'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'items') p WHERE p->>'prospect_status'='Skip' OR p->>'promoted_store_id' IS NOT NULL) THEN RAISE EXCEPTION 'Skip/promoted rows visible'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'items') p WHERE p->>'recheck_note' NOT LIKE 'Go%') THEN RAISE EXCEPTION 'Go rows must come first'; END IF;
  result:=public.ambassador_area_prospects_page('','Williamsbridge-Olinville',1);
  IF jsonb_array_length(result->'items')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(result->'items') p WHERE p->>'neighborhood'<>'Williamsbridge-Olinville') THEN RAISE EXCEPTION 'Neighborhood filter failed'; END IF;
  result:=public.ambassador_area_prospects_page('228 Deli And African Market','',1);
  IF (result->>'total')::integer<>1 THEN RAISE EXCEPTION 'Search failed'; END IF;
  BEGIN
    INSERT INTO public.store_prospects(prospect_key) VALUES ('ambassador-rollback-write-test');
    RAISE EXCEPTION 'Ambassador INSERT allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.store_prospects SET priority_score=priority_score;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Ambassador UPDATE allowed'; END IF;
  DELETE FROM public.store_prospects;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Ambassador DELETE allowed'; END IF;
  BEGIN
    PERFORM public.promote_store_prospect((SELECT prospect_key FROM public.store_prospects LIMIT 1));
    RAISE EXCEPTION 'Ambassador promotion allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"ba3c3c44-0ea3-45a9-9679-05ba8231cc92","role":"authenticated"}',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.store_prospects) THEN RAISE EXCEPTION 'No-territory ambassador can read'; END IF;
  IF (public.ambassador_area_prospects_page('','',1)->>'total')::integer<>0 THEN RAISE EXCEPTION 'No-territory list not empty'; END IF;
END $$;
SELECT 'All ambassador area prospect assertions passed' AS result;
ROLLBACK;