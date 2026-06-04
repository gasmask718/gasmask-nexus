
-- T1 floor_directory updates
UPDATE public.floor_directory SET status='ready', gaps_count=GREATEST(gaps_count-1,0), last_audited=now()
  WHERE page_route='/';
UPDATE public.floor_directory SET status='kill_pending', last_audited=now()
  WHERE page_route IN ('/opportunity-radar','/finance/opportunity-radar','/ops/opportunity-radar');
UPDATE public.floor_directory SET status='kill_pending', last_audited=now()
  WHERE page_route='/shop';
UPDATE public.floor_directory SET status='ready', last_audited=now()
  WHERE page_route='/store';

-- Deprecation comments (no drops)
COMMENT ON TABLE public.stores IS 'DEPRECATED 2026-06-04 (T1): use store_master. Dashboard migrated. Pending sweep of remaining readers.';
