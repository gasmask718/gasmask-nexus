
ALTER TABLE public.floor_directory DROP CONSTRAINT floor_directory_status_check;
ALTER TABLE public.floor_directory ADD CONSTRAINT floor_directory_status_check
  CHECK (status = ANY (ARRAY['ready','needs_work','stub','kill_pending','dormant','planned','blocked_on_owner']));

-- Fix route mismatches first
UPDATE public.floor_directory SET page_route = '/va-ranking' WHERE page_route = '/va/ranking';
UPDATE public.floor_directory SET page_route = '/va-task-center' WHERE page_route = '/va/task-center';

-- kill_pending → ready (redirects/deletions done in same turn)
UPDATE public.floor_directory
  SET status='ready', gaps_count=0,
      purpose='Redirects to /wholesale/marketplace — legacy theatre page deleted',
      last_audited=now()
  WHERE page_route='/wholesale';

UPDATE public.floor_directory
  SET status='ready', gaps_count=0,
      purpose='Redirects to /dynasty-direct/d2c-storefront — legacy /shop deleted',
      last_audited=now()
  WHERE page_route='/shop';

-- needs_work conflict: /missions → redirect to /penthouse/missions
UPDATE public.floor_directory
  SET status='ready', gaps_count=0,
      purpose='Redirects to /penthouse/missions — duplicate page deleted',
      last_audited=now()
  WHERE page_route='/missions';

-- Genuine owner-dependent items → blocked_on_owner
UPDATE public.floor_directory
  SET status='blocked_on_owner', gaps_count=0,
      purpose='VA performance hub — awaits real VA activity to populate (no writer until VA team is live)',
      last_audited=now()
  WHERE page_route='/va-performance';

UPDATE public.floor_directory
  SET status='blocked_on_owner', gaps_count=0,
      purpose='VA leaderboard — awaits real VA activity data',
      last_audited=now()
  WHERE page_route='/va-ranking';

UPDATE public.floor_directory
  SET status='blocked_on_owner', gaps_count=0,
      purpose='VA Task Center — awaits David ruling on task source (deprecated va_tasks vs. new system)',
      last_audited=now()
  WHERE page_route='/va-task-center';

UPDATE public.floor_directory
  SET status='blocked_on_owner', gaps_count=0,
      purpose='Self-serve HR — awaits real employees onboarded with user accounts',
      last_audited=now()
  WHERE page_route='/my-hr';
